import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import { anthropic } from './client';
import { GENERATION_MODEL } from './models';
import type { IntakeDocument } from '@/lib/types';

const SCHEMA = {
  type: 'object',
  properties: {
    headlines: {
      type: 'array',
      description: '3 distinct headline options, each at most 200 characters.',
      items: { type: 'string' },
      minItems: 3,
      maxItems: 3,
    },
  },
  required: ['headlines'],
  additionalProperties: false,
};

/**
 * Generates a few elite profile-headline options from the candidate's own
 * materials. Grounded, high-impact, no clichés, no em dashes (house style).
 * Returns [] when there is nothing to reason from.
 */
export async function suggestHeadlines(params: {
  resumeMarkdown: string | null;
  sources: IntakeDocument[];
  targetRole: string | null;
  summaryBullets: string[];
}): Promise<string[]> {
  const docs = [
    params.targetRole ? `### TARGET ROLE\n${params.targetRole}` : '',
    params.summaryBullets.filter((b) => b.trim()).length
      ? `### CAREER HIGHLIGHTS\n${params.summaryBullets.filter((b) => b.trim()).map((b) => `- ${b}`).join('\n')}`
      : '',
    params.resumeMarkdown ? `### RÉSUMÉ\n${params.resumeMarkdown}` : '',
    ...params.sources.filter((s) => s.text.trim()).map((s) => `### ${s.label}\n${s.text}`),
  ]
    .filter(Boolean)
    .join('\n\n');
  if (!docs.trim()) return [];

  const system = `You are an elite personal-brand strategist writing the headline at the very top of a candidate's public career profile. A recruiter reads it in 5 seconds and must instantly get who this person is and why they are exceptional.

Write 3 distinct headline options. Rules:
- Each is at most 200 characters. Punchy and scannable, not a paragraph.
- Ground every claim strictly in the candidate's materials (role, domain, scale, quantified results). Never invent a number, title, or achievement.
- Lead with their strongest, most specific differentiator. Prefer concrete outcomes (percentages, dollar figures, scope) over vague adjectives.
- If a target role is given, position the headline toward it.
- Vary the angle across the three: (1) metrics/results-forward, (2) identity/positioning-forward as one sharp sentence, (3) a scannable pipe-delimited value stack (e.g. "Title | Domain | Signature result | Core skills").
- No clichés ("results-driven", "proven track record", "passionate"), no fluff, no first-person "I".
- Never use em dashes or en dashes. Use commas, colons, or pipes.

Submit via the submit_headlines tool.`;

  const response = await anthropic.messages.create({
    model: GENERATION_MODEL,
    max_tokens: 600,
    system,
    tools: [
      {
        name: 'submit_headlines',
        description: 'Submit the 3 headline options.',
        input_schema: SCHEMA as unknown as Anthropic.Messages.Tool.InputSchema,
      },
    ],
    tool_choice: { type: 'tool', name: 'submit_headlines' },
    messages: [{ role: 'user', content: docs }],
  });

  const block = response.content.find((b) => b.type === 'tool_use');
  if (!block || block.type !== 'tool_use') return [];
  const raw = block.input as { headlines?: string[] };
  return (raw.headlines ?? [])
    .map((h) =>
      String(h)
        .replace(/\s*[—–]\s*/g, ', ') // house style: no em/en dashes
        .trim()
        .slice(0, 200),
    )
    .filter(Boolean)
    .slice(0, 3);
}
