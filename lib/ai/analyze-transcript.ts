import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import { anthropic } from './client';
import { GENERATION_MODEL } from './models';
import { BRAIN_CATEGORIES } from './intake';
import type { CandidateBrain, ChatTurn, TranscriptGapItem } from '@/lib/types';

const SYSTEM_PROMPT = `You analyze a recruiter's conversation with a candidate's career AI to find where the brain fell short, so the candidate can strengthen it.

Compare the transcript to the candidate's verified career data and identify gaps:
- "deflection": the AI declined or could not answer because the data was not there.
- "weak": the AI answered vaguely, or the recruiter had to follow up to get specifics.
- "new_topic": the recruiter raised a topic the brain does not cover at all.

For each gap, write a specific, ready-to-show expansion prompt grounded in what the brain already has -- never generic. Map each to exactly one brain category: ${BRAIN_CATEGORIES.join(', ')}. Assign a priority (high = the recruiter clearly needed it and didn't get it). Return at most 5 gaps, highest priority first. If the AI handled everything well, return an empty array. Submit via the submit_gaps tool.`;

const GAPS_SCHEMA = {
  type: 'object',
  properties: {
    gaps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          questionAsked: { type: 'string' },
          chatbotAnswer: { type: 'string' },
          gapType: { type: 'string', enum: ['deflection', 'weak', 'new_topic'] },
          suggestedPrompt: { type: 'string' },
          category: { type: 'string', enum: [...BRAIN_CATEGORIES] },
          priority: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['questionAsked', 'chatbotAnswer', 'gapType', 'suggestedPrompt', 'category', 'priority'],
        additionalProperties: false,
      },
    },
  },
  required: ['gaps'],
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
 * Analyzes a finished recruiter transcript against the brain and returns the
 * gaps worth surfacing to the candidate. Returns [] on any failure (best-effort,
 * called fire-and-forget from transcript delivery).
 */
export async function analyzeTranscriptGaps(params: {
  candidate: CandidateBrain;
  resumeMarkdown: string | null;
  messages: ChatTurn[];
}): Promise<TranscriptGapItem[]> {
  const transcript = params.messages
    .map((m) => `${m.role === 'user' ? 'Recruiter' : 'AI'}: ${m.content}`)
    .join('\n');

  try {
    const response = await anthropic.messages.create({
      model: GENERATION_MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      tools: [
        {
          name: 'submit_gaps',
          description: 'Submit the gaps found in the transcript.',
          input_schema: GAPS_SCHEMA as unknown as Anthropic.Messages.Tool.InputSchema,
        },
      ],
      tool_choice: { type: 'tool', name: 'submit_gaps' },
      messages: [
        {
          role: 'user',
          content: `CANDIDATE CAREER DATA:\n${careerData(params.candidate, params.resumeMarkdown)}\n\nTRANSCRIPT:\n${transcript}`,
        },
      ],
    });

    const block = response.content.find((b) => b.type === 'tool_use');
    if (!block || block.type !== 'tool_use') return [];
    const raw = block.input as { gaps?: TranscriptGapItem[] };
    return (raw.gaps ?? []).slice(0, 5);
  } catch (e) {
    console.error('analyzeTranscriptGaps: failed', e);
    return [];
  }
}
