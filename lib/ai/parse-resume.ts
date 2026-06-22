import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import { anthropic } from './client';
import { GENERATION_MODEL } from './models';
import {
  CANONICAL_RESUME_JSON_SCHEMA,
  CanonicalResumeSchema,
  canonicalResumeToMarkdown,
  type CanonicalResume,
} from './canonical-resume';

const SYSTEM_PROMPT = `You are a precise résumé parser. Extract the candidate's career history from the provided résumé text into the structured form requested by the submit_resume tool.

Rules:
- Use ONLY information present in the text. Never invent employers, dates, titles, or metrics.
- Preserve quantified achievements (numbers, %, $) verbatim in highlights.
- Normalize dates to a short readable form (e.g. "Jan 2021", "Present").
- If a field is genuinely absent, omit it rather than guessing.
- Keep highlights concise, one accomplishment each.`;

/**
 * Parse raw résumé text (already extracted from PDF/DOCX/TXT) into the canonical
 * structured form plus an editable Markdown rendering. Uses Sonnet with a forced
 * tool call so the model must return structured output, then re-validates with Zod.
 */
export async function parseResumeText(
  rawText: string,
): Promise<{ json: CanonicalResume; markdown: string }> {
  const response = await anthropic.messages.create({
    model: GENERATION_MODEL,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    tools: [
      {
        name: 'submit_resume',
        description: 'Submit the structured résumé extracted from the source text.',
        input_schema: CANONICAL_RESUME_JSON_SCHEMA as unknown as Anthropic.Messages.Tool.InputSchema,
      },
    ],
    tool_choice: { type: 'tool', name: 'submit_resume' },
    messages: [{ role: 'user', content: rawText }],
  });

  const toolUse = response.content.find((block) => block.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Résumé parsing did not return structured output');
  }

  const json = CanonicalResumeSchema.parse(toolUse.input);
  return { json, markdown: canonicalResumeToMarkdown(json) };
}
