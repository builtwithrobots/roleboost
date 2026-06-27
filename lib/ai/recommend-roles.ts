import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import { anthropic } from './client';
import { GENERATION_MODEL } from './models';
import type { IntakeDocument } from '@/lib/types';

export interface RecommendedRole {
  /** A specific, realistic job title. */
  title: string;
  /** One sentence, second person, grounded in the candidate's materials. */
  why: string;
}

const SCHEMA = {
  type: 'object',
  properties: {
    roles: {
      type: 'array',
      description: '3 to 5 specific roles this candidate is most competitively positioned for right now.',
      items: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'A specific, realistic job title at the right seniority (e.g. "Director of Fulfillment Operations"), not a generic or aspirational reach.',
          },
          why: {
            type: 'string',
            description: 'One sentence in second person ("Your...") citing concrete evidence from their materials.',
          },
        },
        required: ['title', 'why'],
        additionalProperties: false,
      },
    },
  },
  required: ['roles'],
  additionalProperties: false,
};

/**
 * Recommends target roles from the candidate's uploaded materials (résumé +
 * career sources). Returns [] when there is nothing to reason from or the model
 * returns no structured output.
 */
export async function recommendRoles(
  resumeMarkdown: string | null,
  sources: IntakeDocument[],
): Promise<RecommendedRole[]> {
  const docs = [
    resumeMarkdown ? `### RÉSUMÉ\n${resumeMarkdown}` : '',
    ...sources.filter((s) => s.text.trim()).map((s) => `### ${s.label}\n${s.text}`),
  ]
    .filter(Boolean)
    .join('\n\n');
  if (!docs.trim()) return [];

  const system = `You are a career strategist. From the candidate's materials, recommend the 3–5 roles they are most competitively positioned for right now.

Rules:
- Favor specific, realistic titles at the seniority their experience actually supports — not generic ("Manager") and not an aspirational reach.
- Ground each recommendation in concrete evidence from their materials (scope, domain, results).
- Each "why" is exactly one sentence, written to the candidate in second person.
- Order from strongest fit to least.

Submit via the submit_roles tool.`;

  const response = await anthropic.messages.create({
    model: GENERATION_MODEL,
    max_tokens: 1200,
    system,
    tools: [
      {
        name: 'submit_roles',
        description: 'Submit the recommended roles.',
        input_schema: SCHEMA as unknown as Anthropic.Messages.Tool.InputSchema,
      },
    ],
    tool_choice: { type: 'tool', name: 'submit_roles' },
    messages: [{ role: 'user', content: docs }],
  });

  const block = response.content.find((b) => b.type === 'tool_use');
  if (!block || block.type !== 'tool_use') return [];
  const raw = block.input as { roles?: RecommendedRole[] };
  return (raw.roles ?? [])
    .slice(0, 5)
    .map((r) => ({ title: String(r.title).slice(0, 120), why: String(r.why).slice(0, 320) }))
    .filter((r) => r.title.trim());
}
