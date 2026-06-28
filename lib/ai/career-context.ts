import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import { anthropic } from './client';
import { GENERATION_MODEL } from './models';
import type {
  CareerContextAngle,
  CareerContextDrafts,
  CareerContextStoryType,
  IntakeDocument,
} from '@/lib/types';

// Runs the RoleBoost Candidate Asset Production Skill (Section 1 -- the Narrative
// Guide Block only; the NotebookLM prompt sets in Section 2 are intentionally
// omitted here). Reads the candidate's résumé + career sources, applies the AI
// Mirror, selects a story type, and produces TWO distinct narrative angles plus a
// recommendation. The candidate picks one downstream; the chosen angle's rendered
// markdown becomes their active career-context document.

const STORY_TYPES: CareerContextStoryType[] = [
  'career_arc',
  'builder',
  'problem_solver',
  'leadership',
  'skeptic_champion',
  'specialist',
];

const STORY_TYPE_LABELS: Record<CareerContextStoryType, string> = {
  career_arc: 'The Career Arc',
  builder: 'The Builder',
  problem_solver: 'The Problem Solver',
  leadership: 'The Leadership Story',
  skeptic_champion: 'The Skeptic and the Champion',
  specialist: 'The Specialist',
};

/** An angle as the model returns it -- the rendered markdown is added afterwards. */
type GeneratedAngle = Omit<CareerContextAngle, 'markdown'>;

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
    throw new Error('Career-context model did not return structured output');
  }
  return block.input as T;
}

function formatDocs(docs: IntakeDocument[]): string {
  return docs
    .filter((d) => d.text.trim())
    .map((d) => `### SOURCE: ${d.label}\n${d.text.trim()}`)
    .join('\n\n');
}

const ANGLE_SCHEMA = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      description: 'Short label for this framing, e.g. "The Builder" or "Turnaround Operator".',
    },
    story_type: { type: 'string', enum: [...STORY_TYPES] },
    headline: { type: 'string', description: 'One-line professional headline.' },
    target_role: { type: 'string', description: 'The role this candidate is targeting.' },
    location: { type: 'string', description: 'Location, or empty string if unknown.' },
    narrative: {
      type: 'string',
      description:
        '2-3 sentences, third person about the candidate. The human story grounded in evidence -- not a résumé summary.',
    },
    hook: {
      type: 'string',
      description: 'One line. The single most credible, specific fact -- a number, a moment, a result. Never a generality.',
    },
    hard_question: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'The one question every recruiter will ask.' },
        answer: {
          type: 'string',
          description:
            'A tight, specific FIRST-PERSON answer (5-8 sentences) using only evidence from the file. Direct and confident; no hedging or apology; ends on what the candidate brings.',
        },
      },
      required: ['question', 'answer'],
      additionalProperties: false,
    },
    key_numbers: {
      type: 'array',
      items: { type: 'string' },
      description: '5-8 specific metrics and facts that must appear in every asset (scale, results, span, credentials).',
    },
    positioning: { type: 'string', description: 'A 1-2 sentence positioning statement.' },
  },
  required: ['name', 'story_type', 'headline', 'target_role', 'location', 'narrative', 'hook', 'hard_question', 'key_numbers', 'positioning'],
  additionalProperties: false,
};

const SUBMIT_SCHEMA = {
  type: 'object',
  properties: {
    angle_a: ANGLE_SCHEMA,
    angle_b: ANGLE_SCHEMA,
    recommended: { type: 'string', enum: ['A', 'B'], description: 'Which angle is the stronger lead.' },
  },
  required: ['angle_a', 'angle_b', 'recommended'],
  additionalProperties: false,
};

const SYSTEM = `You are running the RoleBoost Candidate Asset Production Skill (the career-context document portion only). You are given a candidate's résumé and any supporting career sources about the same person. Produce the narrative foundation for their career-context document.

Workflow:
1. Read everything in full.
2. Apply the AI Mirror -- an honest, evidence-based read of what the documents actually show: career trajectory, quantified vs unquantified results, title vs scope, and the single most credible fact in the file. This is an assessment, not a résumé summary.
3. Select the candidate's story type, then define TWO genuinely different narrative angles -- not two tones of one story, but two real framings a candidate could choose between.
4. Recommend the stronger angle.

Story types:
- The Career Arc: strong linear progression with measurable results at each stage.
- The Builder: has built operations, teams, or systems from scratch multiple times.
- The Problem Solver: a pattern of fixing broken things and turning around underperforming situations.
- The Leadership Story: senior candidate -- results and people development both present.
- The Skeptic and the Champion: non-linear path, gap, pivot, or layoff that needs contextualizing.
- The Specialist: deep domain expertise in a niche -- depth is the story, not breadth.

For each angle produce: a name, the story type, a headline, the target role, location, a 2-3 sentence narrative, a one-line hook, the one hard question every recruiter will ask with a tight first-person answer, 5-8 key numbers, and a positioning statement.

Hard rules:
- Every claim must be supported by the provided material. Never invent a number, metric, date, credential, or outcome. If the file is thin, work honestly with what is there.
- The hook must be specific -- a number, a moment, a result -- never a generality like "strong results across a long career".
- Write the narrative in third person about the candidate. Write the hard-question answer in first person ("I ...").
- The hard-question answer is direct and confident, does not hedge or apologize, and ends on what the candidate brings.

Submit via the submit_context tool.`;

function cleanAngle(raw: GeneratedAngle): GeneratedAngle {
  const story_type = STORY_TYPES.includes(raw.story_type) ? raw.story_type : 'career_arc';
  return {
    name: (raw.name ?? '').trim(),
    story_type,
    headline: (raw.headline ?? '').trim(),
    target_role: (raw.target_role ?? '').trim(),
    location: (raw.location ?? '').trim(),
    narrative: (raw.narrative ?? '').trim(),
    hook: (raw.hook ?? '').trim(),
    hard_question: {
      question: (raw.hard_question?.question ?? '').trim(),
      answer: (raw.hard_question?.answer ?? '').trim(),
    },
    key_numbers: Array.isArray(raw.key_numbers)
      ? raw.key_numbers.map((n) => String(n).trim()).filter(Boolean)
      : [],
    positioning: (raw.positioning ?? '').trim(),
  };
}

/** Renders one angle into the markdown document stored as context_package_md. */
function renderAngleMarkdown(a: GeneratedAngle, fullName: string): string {
  const identity = [
    a.target_role && `- **Target role:** ${a.target_role}`,
    a.location && `- **Location:** ${a.location}`,
    a.headline && `- **Headline:** ${a.headline}`,
  ].filter(Boolean);

  const lines = [
    `# ${fullName} — Career Context Document`,
    `**Story type:** ${STORY_TYPE_LABELS[a.story_type]}  ·  **Angle:** ${a.name}`,
    '',
    '## Identity',
    ...identity,
    '',
    '## The Narrative',
    a.narrative,
    '',
    '## The Hook',
    a.hook,
    '',
    '## The Hard Question',
    `**${a.hard_question.question}**`,
    '',
    a.hard_question.answer,
    '',
    '## Key Numbers',
    ...a.key_numbers.map((n) => `- ${n}`),
    '',
    '## Positioning',
    a.positioning,
    '',
  ];
  return lines.join('\n');
}

/**
 * Generates both narrative angles for a candidate's career-context document.
 * Throws if the model returns no structured output. `selected` starts null --
 * the candidate chooses an angle downstream.
 */
export async function generateCareerContext(
  fullName: string,
  resumeMarkdown: string | null,
  sources: IntakeDocument[] = [],
): Promise<CareerContextDrafts> {
  const sourceBlock = sources.filter((s) => s.text.trim()).length
    ? `\n\nSUPPORTING SOURCES:\n${formatDocs(sources)}`
    : '';
  const content = `CANDIDATE: ${fullName}\n\nRÉSUMÉ:\n${resumeMarkdown ?? 'None provided.'}${sourceBlock}`;

  const response = await anthropic.messages.create({
    model: GENERATION_MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    tools: [tool('submit_context', SUBMIT_SCHEMA)],
    tool_choice: { type: 'tool', name: 'submit_context' },
    messages: [{ role: 'user', content }],
  });

  const raw = firstToolInput<{
    angle_a: GeneratedAngle;
    angle_b: GeneratedAngle;
    recommended: string;
  }>(response);

  const a = cleanAngle(raw.angle_a);
  const b = cleanAngle(raw.angle_b);

  return {
    angles: {
      A: { ...a, markdown: renderAngleMarkdown(a, fullName) },
      B: { ...b, markdown: renderAngleMarkdown(b, fullName) },
    },
    recommended: raw.recommended === 'B' ? 'B' : 'A',
    selected: null,
    generated_at: new Date().toISOString(),
  };
}
