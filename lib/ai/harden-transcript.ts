import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import { anthropic } from './client';
import { GENERATION_MODEL } from './models';
import { BRAIN_CATEGORIES } from './intake';
import type { CandidateBrain, BrainHardeningResult } from '@/lib/types';

const FIELD_TARGETS = [...BRAIN_CATEGORIES, 'custom_qa'];

const SYSTEM_PROMPT = `You harden a candidate's career AI against questions that ACTUALLY came up in a real conversation. The candidate pasted a transcript from an external source -- a recruiter screening call, a practice session with another AI, a LinkedIn thread, or interview-debrief notes. Your job is to find where their career AI would fall short on these exact questions and produce a prioritized plan to fix it.

Steps:
1. Extract the substantive questions the candidate was asked (or clearly needs to answer). Ignore pleasantries and scheduling. Count them as questionsFound.
2. For each, judge how well the candidate's verified career data already covers it:
   - "strong": the brain has a specific, grounded answer.
   - "adequate": answerable but thin.
   - "weak": the brain only has a vague or partial answer.
   - "missing": the brain has nothing for this.
3. Put every "weak" and "missing" question into gapsIdentified. For each, write a specific, ready-to-use expansion prompt grounded in what the brain already has -- never generic -- and map it to exactly one target: ${FIELD_TARGETS.join(', ')}.
4. List the questions handled "strong" or "adequate" as short labels in strongCoverageConfirmed.
5. Produce a hardeningPlan: 3-5 actions ranked by impact (priority 1 = do first), each a plain-language instruction plus its brainFieldTarget and expansionPrompt.

Assign each gap a priority: high = a recruiter clearly needed this and the brain can't deliver; low = nice-to-have. If the brain already covers everything well, return empty gapsIdentified and hardeningPlan. Submit via the submit_hardening tool.`;

const HARDENING_SCHEMA = {
  type: 'object',
  properties: {
    questionsFound: { type: 'integer' },
    gapsIdentified: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          questionFromTranscript: { type: 'string' },
          brainCoverageVerdict: { type: 'string', enum: ['strong', 'adequate', 'weak', 'missing'] },
          expansionPrompt: { type: 'string' },
          brainFieldTarget: { type: 'string', enum: FIELD_TARGETS },
          priority: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['questionFromTranscript', 'brainCoverageVerdict', 'expansionPrompt', 'brainFieldTarget', 'priority'],
        additionalProperties: false,
      },
    },
    strongCoverageConfirmed: { type: 'array', items: { type: 'string' } },
    hardeningPlan: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          priority: { type: 'integer' },
          action: { type: 'string' },
          brainFieldTarget: { type: 'string', enum: FIELD_TARGETS },
          expansionPrompt: { type: 'string' },
        },
        required: ['priority', 'action', 'brainFieldTarget', 'expansionPrompt'],
        additionalProperties: false,
      },
    },
  },
  required: ['questionsFound', 'gapsIdentified', 'strongCoverageConfirmed', 'hardeningPlan'],
  additionalProperties: false,
};

function careerData(c: CandidateBrain, resumeMarkdown: string | null): string {
  const blob = [
    resumeMarkdown,
    c.key_wins,
    c.departure_reasons,
    c.biggest_challenge,
    c.leadership_philosophy,
    c.ideal_environment,
    c.manager_needs,
    c.honest_weaknesses,
    c.wish_questions,
    c.additional_context,
    ...c.custom_qa_pairs.map((p) => `${p.question}\n${p.answer}`),
  ]
    .filter(Boolean)
    .join('\n\n');
  return blob || 'No career data has been provided yet.';
}

/**
 * Analyzes an external transcript against the brain and returns a prioritized
 * hardening plan. Throws on failure (the route turns that into a 500) -- unlike
 * the fire-and-forget post-session analyzer, this one is user-initiated and the
 * candidate is waiting on the result.
 */
export async function hardenTranscriptAnalysis(params: {
  candidate: CandidateBrain;
  resumeMarkdown: string | null;
  transcriptText: string;
  sourceContext?: string | null;
}): Promise<BrainHardeningResult> {
  const context = params.sourceContext?.trim()
    ? `SOURCE CONTEXT: ${params.sourceContext.trim()}\n\n`
    : '';

  const response = await anthropic.messages.create({
    model: GENERATION_MODEL,
    max_tokens: 3000,
    system: SYSTEM_PROMPT,
    tools: [
      {
        name: 'submit_hardening',
        description: 'Submit the hardening analysis for this transcript.',
        input_schema: HARDENING_SCHEMA as unknown as Anthropic.Messages.Tool.InputSchema,
      },
    ],
    tool_choice: { type: 'tool', name: 'submit_hardening' },
    messages: [
      {
        role: 'user',
        content: `CANDIDATE CAREER DATA:\n${careerData(params.candidate, params.resumeMarkdown)}\n\n${context}TRANSCRIPT:\n${params.transcriptText}`,
      },
    ],
  });

  const block = response.content.find((b) => b.type === 'tool_use');
  if (!block || block.type !== 'tool_use') {
    throw new Error('hardenTranscriptAnalysis: no tool_use block returned');
  }
  const raw = block.input as Partial<BrainHardeningResult>;
  return {
    questionsFound: raw.questionsFound ?? 0,
    gapsIdentified: (raw.gapsIdentified ?? []).slice(0, 12),
    strongCoverageConfirmed: raw.strongCoverageConfirmed ?? [],
    hardeningPlan: (raw.hardeningPlan ?? []).sort((a, b) => a.priority - b.priority).slice(0, 5),
  };
}
