import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import { anthropic } from './client';
import { GENERATION_MODEL } from './models';
import type {
  BrainReadiness,
  IntakeAnswer,
  IntakeDocument,
  IntakeInconsistency,
  IntakeQuestion,
} from '@/lib/types';

// The brain fields intake answers map to and are synthesized into. Questions are
// tagged with one of these categories so each answer feeds the right field.
export const BRAIN_CATEGORIES = [
  'key_wins',
  'leadership_philosophy',
  'departure_reasons',
  'biggest_challenge',
  'ideal_environment',
  'manager_needs',
  'honest_weaknesses',
  'wish_questions',
] as const;

export type BrainFieldKey = (typeof BRAIN_CATEGORIES)[number];

export type AssembledBrain = Record<BrainFieldKey, string>;

const CATEGORY_LIST = BRAIN_CATEGORIES.join(', ');

function tool(name: string, schema: object): Anthropic.Messages.Tool {
  return {
    name,
    description: 'Submit the structured result.',
    input_schema: schema as unknown as Anthropic.Messages.Tool.InputSchema,
  };
}

function firstToolInput<T>(response: Anthropic.Messages.Message): T {
  const block = response.content.find((b) => b.type === 'tool_use');
  if (!block || block.type !== 'tool_use') {
    throw new Error('Intake model did not return structured output');
  }
  return block.input as T;
}

function formatDocs(docs: IntakeDocument[]): string {
  return docs
    .filter((d) => d.text.trim())
    .map((d) => `### SOURCE: ${d.label}\n${d.text.trim()}`)
    .join('\n\n');
}

function formatAnswers(answers: IntakeAnswer[]): string {
  if (answers.length === 0) return 'No answers yet.';
  return answers
    .map((a) => `Q (${a.category}): ${a.questionText}\nA: ${a.answerText}`)
    .join('\n\n');
}

// ── Pass 1 -- document analysis ──────────────────────────────────────────────

const PASS1_SCHEMA = {
  type: 'object',
  properties: {
    inconsistencies: {
      type: 'array',
      description:
        'Cross-document contradictions (title/date/scope mismatches, a gap on one source but not another). Empty if only one source was provided or none found.',
      items: {
        type: 'object',
        properties: {
          sourceA: { type: 'string' },
          sourceB: { type: 'string' },
          description: { type: 'string', description: 'Plain-language explanation a candidate can act on.' },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['sourceA', 'sourceB', 'description', 'severity'],
        additionalProperties: false,
      },
    },
    questions: {
      type: 'array',
      description: '8 to 12 questions a recruiter would most likely ask, derived from what the documents show.',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          context: { type: 'string', description: 'One sentence on why this is being asked.' },
          category: { type: 'string', enum: [...BRAIN_CATEGORIES] },
        },
        required: ['question', 'context', 'category'],
        additionalProperties: false,
      },
    },
  },
  required: ['inconsistencies', 'questions'],
  additionalProperties: false,
};

export async function analyzeIntakePass1(
  docs: IntakeDocument[],
): Promise<{ inconsistencies: IntakeInconsistency[]; questions: IntakeQuestion[] }> {
  const multiSource = docs.filter((d) => d.text.trim()).length > 1;

  const system = `You are a senior recruiter and ATS specialist preparing a candidate's AI brain. You are given one or more source documents about the same person.

Do two things:
1. ${multiSource ? 'Flag genuine cross-document inconsistencies (title, date, scope, or gap mismatches between sources). Only real contradictions -- do not invent any.' : 'Only one source was provided, so return an empty inconsistencies array.'}
2. Generate 8 to 12 questions a recruiter would most likely ask this specific candidate, derived from what the documents actually show -- gaps, short tenures, pivots, departures, big claims needing backup, missing metrics. Each question maps to exactly one brain category: ${CATEGORY_LIST}.

Be specific to this candidate. Submit via the submit_pass1 tool.`;

  const response = await anthropic.messages.create({
    model: GENERATION_MODEL,
    max_tokens: 2000,
    system,
    tools: [tool('submit_pass1', PASS1_SCHEMA)],
    tool_choice: { type: 'tool', name: 'submit_pass1' },
    messages: [{ role: 'user', content: formatDocs(docs) || 'No documents provided.' }],
  });

  const raw = firstToolInput<{
    inconsistencies: Omit<IntakeInconsistency, 'id'>[];
    questions: { question: string; context: string; category: string }[];
  }>(response);

  const inconsistencies: IntakeInconsistency[] = (raw.inconsistencies ?? []).map((c, i) => ({
    id: `inc-${i + 1}`,
    ...c,
  }));
  const questions: IntakeQuestion[] = (raw.questions ?? []).slice(0, 12).map((q, i) => ({
    id: `p1-${i + 1}`,
    question: q.question,
    context: q.context,
    category: q.category,
    pass: 1,
  }));

  return { inconsistencies, questions };
}

// ── Pass 2 / 3 -- targeted follow-ups ────────────────────────────────────────

const FOLLOWUP_SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      description: 'Follow-up questions only for vague/incomplete prior answers. Empty array if the answers are already strong.',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          context: { type: 'string' },
          category: { type: 'string', enum: [...BRAIN_CATEGORIES] },
        },
        required: ['question', 'context', 'category'],
        additionalProperties: false,
      },
    },
  },
  required: ['questions'],
  additionalProperties: false,
};

export async function generateNextPass(
  pass: 2 | 3,
  docs: IntakeDocument[],
  previousAnswers: IntakeAnswer[],
  remaining: number,
): Promise<IntakeQuestion[]> {
  if (remaining <= 0) return [];
  const max = pass === 2 ? Math.min(6, remaining) : Math.min(4, remaining);

  const system = `You are conducting a layered candidate intake interview. Review the answers given so far and decide whether any need a follow-up.

${
    pass === 2
      ? `Pass 2: generate up to ${max} follow-up questions ONLY for answers that were vague, generic, or missing specifics (numbers, names, outcomes). Skip answers that were already specific and complete.`
      : `Pass 3: generate up to ${max} final probes ONLY for genuine gaps that remain. Often the right answer is an empty array.`
  }

Each question maps to one brain category: ${CATEGORY_LIST}. Return an empty array if nothing needs deepening. Submit via the submit_followups tool.`;

  const content = `SOURCE DOCUMENTS:\n${formatDocs(docs) || 'None.'}\n\nANSWERS SO FAR:\n${formatAnswers(previousAnswers)}`;

  const response = await anthropic.messages.create({
    model: GENERATION_MODEL,
    max_tokens: 1500,
    system,
    tools: [tool('submit_followups', FOLLOWUP_SCHEMA)],
    tool_choice: { type: 'tool', name: 'submit_followups' },
    messages: [{ role: 'user', content }],
  });

  const raw = firstToolInput<{ questions: { question: string; context: string; category: string }[] }>(response);
  return (raw.questions ?? []).slice(0, max).map((q, i) => ({
    id: `p${pass}-${i + 1}`,
    question: q.question,
    context: q.context,
    category: q.category,
    pass,
  }));
}

// ── Brain assembly -- synthesize answers into the brain fields ────────────────

const BRAIN_SCHEMA = {
  type: 'object',
  properties: Object.fromEntries(
    BRAIN_CATEGORIES.map((k) => [
      k,
      { type: 'string', description: `First-person synthesis for "${k}", grounded only in the answers. Empty string if not covered.` },
    ]),
  ),
  required: [...BRAIN_CATEGORIES],
  additionalProperties: false,
};

export async function assembleBrainFromIntake(
  resumeMarkdown: string | null,
  answers: IntakeAnswer[],
): Promise<AssembledBrain> {
  const system = `You assemble a candidate's AI "brain" from their intake interview. Synthesize their answers into clean, first-person context fields the AI will speak from.

Rules:
- Use ONLY what the candidate said in their answers (and the résumé for grounding). Never invent facts, numbers, or credentials.
- Write in first person ("I led...", "I left because...").
- Each field is a concise paragraph. If a field has no supporting answer, return an empty string for it.
- Group each answer into the field that matches its category.

Fields: ${CATEGORY_LIST}. Submit via the submit_brain tool.`;

  const content = `RÉSUMÉ (for grounding only):\n${resumeMarkdown ?? 'None.'}\n\nINTERVIEW ANSWERS:\n${formatAnswers(answers)}`;

  const response = await anthropic.messages.create({
    model: GENERATION_MODEL,
    max_tokens: 3000,
    system,
    tools: [tool('submit_brain', BRAIN_SCHEMA)],
    tool_choice: { type: 'tool', name: 'submit_brain' },
    messages: [{ role: 'user', content }],
  });

  const raw = firstToolInput<Partial<AssembledBrain>>(response);
  const brain = {} as AssembledBrain;
  for (const k of BRAIN_CATEGORIES) brain[k] = (raw[k] ?? '').trim();
  return brain;
}

// ── Brain readiness score (pure) ─────────────────────────────────────────────

const READINESS_GROUPS: { label: string; fields: BrainFieldKey[] }[] = [
  { label: 'Core & wins', fields: ['key_wins'] },
  { label: 'Hard questions', fields: ['departure_reasons', 'biggest_challenge'] },
  { label: 'Leadership', fields: ['leadership_philosophy', 'manager_needs'] },
  { label: 'Depth & fit', fields: ['ideal_environment', 'honest_weaknesses', 'wish_questions'] },
];

/** A field counts as covered when it has meaningful content (>50 chars). */
export function computeReadiness(brain: Partial<Record<BrainFieldKey, string | null>>): BrainReadiness {
  const categories = READINESS_GROUPS.map((g) => {
    const filled = g.fields.filter((f) => (brain[f]?.trim().length ?? 0) > 50).length;
    return { label: g.label, score: Math.round((filled / g.fields.length) * 100) };
  });
  const overall = Math.round(categories.reduce((s, c) => s + c.score, 0) / categories.length);
  return { overall, categories };
}
