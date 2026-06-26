import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import { anthropic } from './client';
import { GENERATION_MODEL } from './models';
import type { CandidateBrain, SandboxAnalysis, SandboxVerdict } from '@/lib/types';

const SYSTEM_PROMPT = `You are an elite recruiting coach. A candidate has a personal career AI that answers recruiters on their behalf. Your job is to evaluate how that AI answered one hard recruiter question, judged ONLY against the candidate's verified career data, and tell the candidate exactly what to fix.

Evaluate the answer against this rubric:
- Did it use specific, documented facts, or vague generalizations?
- Did it stay grounded in the career data, or drift toward invented detail?
- Was the length appropriate -- not too short, not a wall of text?
- Did it sound like a real person, or a generic AI?
- If the question was adversarial or had a false premise, did it stay calm and correct the premise, or capitulate?
- If the answer stated a number, metric, or credential, is that claim present in the career data?

Then assign a verdict:
- "strong" -- grounded, specific, and handled the question well.
- "adequate" -- acceptable but would be stronger with more context.
- "weak" -- vague, deflected unnecessarily, or missed the point.
- "hallucinated" -- contains a claim (number, credential, fact) NOT present in the career data. This is the most serious verdict.

Rules for your output:
- The diagnosis must be specific and reference what the answer actually did. Never write "this could be improved."
- The prescription must say exactly what to add and where.
- brainFieldTarget must be the single field most worth strengthening: one of leadership_philosophy, key_wins, departure_reasons, biggest_challenge, ideal_environment, manager_needs, honest_weaknesses, wish_questions, or custom_qa. Use null only if nothing needs work.
- The expansionPrompt is a concrete question that prompts the candidate to write the missing context, grounded in what is already there.
Submit your evaluation via the submit_analysis tool.`;

const ANALYSIS_JSON_SCHEMA = {
  type: 'object',
  properties: {
    verdict: {
      type: 'string',
      enum: ['strong', 'adequate', 'weak', 'hallucinated'],
      description: 'The overall verdict for this answer.',
    },
    diagnosis: {
      type: 'string',
      description: 'Plain-language, specific finding: what the answer did well or poorly and why. Never generic.',
    },
    prescription: {
      type: 'string',
      description: 'Exactly what to add and where to make the answer stronger.',
    },
    brainFieldTarget: {
      type: 'string',
      description:
        'The single brain field most worth strengthening: leadership_philosophy, key_wins, departure_reasons, biggest_challenge, ideal_environment, manager_needs, honest_weaknesses, wish_questions, or custom_qa. Omit if nothing needs work.',
    },
    expansionPrompt: {
      type: 'string',
      description: 'A concrete prompt that gets the candidate started writing the missing context.',
    },
  },
  required: ['verdict', 'diagnosis', 'prescription', 'expansionPrompt'],
  additionalProperties: false,
};

/**
 * Evaluates one sandbox answer against the candidate's verified brain using
 * Sonnet with a forced tool call (mirrors lib/ai/parse-resume.ts), so the model
 * must return structured output. Returns the validated coaching analysis.
 */
export async function analyzeSandboxAnswer(params: {
  candidate: CandidateBrain;
  resumeMarkdown: string | null;
  question: string;
  answer: string;
  category: string;
}): Promise<SandboxAnalysis> {
  const careerData = assembleCareerData(params.candidate, params.resumeMarkdown);

  const userContent = `RECRUITER QUESTION (category: ${params.category}):
${params.question}

THE CANDIDATE'S AI ANSWERED:
${params.answer}

THE CANDIDATE'S VERIFIED CAREER DATA (the only facts the AI is allowed to use):
${careerData}`;

  const response = await anthropic.messages.create({
    model: GENERATION_MODEL,
    max_tokens: 1000,
    system: SYSTEM_PROMPT,
    tools: [
      {
        name: 'submit_analysis',
        description: 'Submit the structured evaluation of the answer.',
        input_schema: ANALYSIS_JSON_SCHEMA as unknown as Anthropic.Messages.Tool.InputSchema,
      },
    ],
    tool_choice: { type: 'tool', name: 'submit_analysis' },
    messages: [{ role: 'user', content: userContent }],
  });

  const toolUse = response.content.find((block) => block.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Sandbox analysis did not return structured output');
  }

  const raw = toolUse.input as {
    verdict: SandboxVerdict;
    diagnosis: string;
    prescription: string;
    brainFieldTarget?: string | null;
    expansionPrompt: string;
  };

  return {
    verdict: raw.verdict,
    diagnosis: raw.diagnosis,
    prescription: raw.prescription,
    brainFieldTarget: raw.brainFieldTarget?.trim() ? raw.brainFieldTarget.trim() : null,
    expansionPrompt: raw.expansionPrompt,
  };
}

/** Assembles every factual field of the brain into one reference blob. */
function assembleCareerData(c: CandidateBrain, resumeMarkdown: string | null): string {
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
