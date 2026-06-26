import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';
import { anthropic } from '@/lib/ai/client';
import { CHAT_MODEL, GENERATION_MODEL } from '@/lib/ai/models';
import { buildCandidateSystemPrompt } from '@/lib/ai/build-system-prompt';
import { getCandidateBrainBySlug } from '@/lib/ai/get-candidate-brain';
import { ensureChatSession, logChatExchange } from '@/lib/ai/log-chat';
import type { CandidateBrain } from '@/lib/types';

// Node runtime: the Anthropic SDK and service-role logging need Node APIs.
// This route is intentionally open to anonymous recruiters -- no Clerk session
// is required (CLAUDE.md reserves /api for callers without a Clerk session).
export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_HISTORY = 20;

const ChatInput = z.object({
  candidateSlug: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  sessionId: z.string().uuid().optional(),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(4000),
      }),
    )
    .max(MAX_HISTORY)
    .optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_INPUT', message: 'Expected JSON body' } },
      { status: 400 },
    );
  }

  const parsed = ChatInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'INVALID_INPUT', details: parsed.error.issues } },
      { status: 400 },
    );
  }
  const { candidateSlug, message, sessionId, conversationHistory = [] } = parsed.data;

  const brain = await getCandidateBrainBySlug(candidateSlug);
  if (!brain || !brain.aiEnabled) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Profile not found or AI is disabled' } },
      { status: 404 },
    );
  }

  // Recruiters are anonymous and may only chat with published profiles. The
  // owner (authenticated) can preview their own AI before publishing.
  const { userId } = await auth();
  const isOwner = !!userId && userId === brain.ownerClerkUserId;
  if (!brain.isPublished && !isOwner) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Profile not found or AI is disabled' } },
      { status: 404 },
    );
  }

  const systemPrompt = buildCandidateSystemPrompt(brain.candidate, brain.resumeMarkdown);

  // ── Complexity router ──────────────────────────────────────────────────────
  // Adversarial / multi-part / synthesis questions go to Sonnet for better
  // reasoning; everything else stays on Haiku. Fast string heuristic, no API call.
  const wasComplex = detectComplexQuestion(message);
  const model = wasComplex ? GENERATION_MODEL : CHAT_MODEL;

  let answer = '';
  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 500,
      system: systemPrompt,
      messages: [
        ...conversationHistory.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: message },
      ],
    });
    // Guard the block type rather than blind-indexing content[0].
    const textBlock = response.content.find((b) => b.type === 'text');
    if (textBlock && textBlock.type === 'text') answer = textBlock.text.trim();
  } catch (e) {
    console.error('chat: generation failed', candidateSlug, e);
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Chat generation failed' } },
      { status: 500 },
    );
  }

  if (!answer) {
    answer = "I'm sorry, I couldn't answer that just now. Please try asking again.";
  }

  // ── Post-generation validation ─────────────────────────────────────────────
  // Only runs when the answer asserts a specific number, figure, or credential.
  // Confirms each claim traces back to the brain; if not, swaps in a safe,
  // natural deflection. Fail-safe: any error returns the original answer.
  let wasValidated = false;
  if (detectHighRiskContent(answer)) {
    wasValidated = true;
    answer = await validateAndSanitize(answer, brain.candidate, brain.resumeMarkdown);
  }

  // Owner self-tests are marked as sandbox so they don't pollute recruiter
  // analytics. Anonymous recruiter sessions log the viewer id when present.
  const resolvedSessionId = await ensureChatSession(brain.candidateProfileId, sessionId, {
    viewerClerkUserId: userId ?? null,
    isSandbox: isOwner,
  });
  if (resolvedSessionId) {
    await logChatExchange({
      sessionId: resolvedSessionId,
      question: message,
      answer,
      modelUsed: model,
      wasComplex,
      wasValidated,
    });
  }

  return NextResponse.json({ answer, sessionId: resolvedSessionId ?? sessionId ?? null });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Detects whether a recruiter question is complex enough to warrant Sonnet.
 * Triggers on adversarial framing, multi-fact synthesis, or multi-clause
 * questions. Fast string heuristic -- no API call. Errs toward Sonnet: a false
 * positive costs a few cents, a false negative costs answer quality.
 */
function detectComplexQuestion(message: string): boolean {
  const lower = message.toLowerCase();

  const adversarialSignals = [
    'why should i',
    'convince me',
    'prove',
    'walk me through exactly',
    'how did you calculate',
    'how did you arrive',
    'that seems',
    'i find it hard to believe',
    'your resume shows',
    'i notice that',
    'i see that',
    'but you left',
    'short tenure',
    'job hopp',
    'why would this be different',
    'what actually happened',
    'be honest',
    'really why',
    'true reason',
  ];

  const synthesisSignals = [
    'given that',
    'considering',
    'taking into account',
    'with your background',
    'despite',
    'even though',
    'and also',
    'in addition to',
    'gap',
    'pivot',
    'switch',
    'change',
    'transition',
    'commitment',
  ];

  const hasAdversarialSignal = adversarialSignals.some((s) => lower.includes(s));
  const hasTwoOrMoreSynthesisSignals =
    synthesisSignals.filter((s) => lower.includes(s)).length >= 2;
  const hasMultipleClauses =
    (lower.match(/\band\b|\bbut\b|\bhowever\b|\balso\b/g) ?? []).length >= 2;

  return hasAdversarialSignal || hasTwoOrMoreSynthesisSignals || hasMultipleClauses;
}

/**
 * Detects whether a generated answer contains high-risk content -- specific
 * numbers, dollar figures, percentages, or credential claims that must trace
 * back to the brain. Fast regex, no API call.
 */
function detectHighRiskContent(answer: string): boolean {
  const highRiskPatterns = [
    /\$[\d,]+/, // dollar figures
    /\d+%/, // percentages
    /\d+[xX]\b/, // multipliers (3x, 10X)
    /\d{4}/, // four-digit numbers (years, large figures)
    /certified|certification|license|degree|pmp|six sigma|lean/i,
  ];
  return highRiskPatterns.some((pattern) => pattern.test(answer));
}

/**
 * Post-generation validation pass. Asks Sonnet whether every specific number or
 * credential in the answer appears in the candidate's career data. If grounded,
 * returns the answer unchanged; if not, returns a natural deflection. Any failure
 * returns the original answer rather than breaking the chat (fail-safe).
 */
async function validateAndSanitize(
  answer: string,
  candidate: CandidateBrain,
  resumeMarkdown: string | null,
): Promise<string> {
  const careerData = [
    resumeMarkdown,
    candidate.key_wins,
    candidate.departure_reasons,
    candidate.biggest_challenge,
    candidate.leadership_philosophy,
    candidate.ideal_environment,
    candidate.manager_needs,
    candidate.honest_weaknesses,
    candidate.wish_questions,
    candidate.additional_context,
    ...candidate.custom_qa_pairs.map((p) => `${p.question}\n${p.answer}`),
  ]
    .filter(Boolean)
    .join('\n\n');

  const validationPrompt = `You are validating an AI-generated answer for factual grounding.

CANDIDATE CAREER DATA:
${careerData}

GENERATED ANSWER TO CHECK:
"${answer}"

Task: Does every specific number, dollar figure, percentage, multiplier, year, certification, or credential mentioned in the answer appear explicitly in the career data above?

Return valid JSON only. No preamble, no markdown. Examples:
{"grounded": true, "unsupported_claims": []}
{"grounded": false, "unsupported_claims": ["$2.4M budget", "67% reduction"]}`;

  try {
    const validation = await anthropic.messages.create({
      model: GENERATION_MODEL,
      max_tokens: 200,
      messages: [{ role: 'user', content: validationPrompt }],
    });

    const block = validation.content.find((b) => b.type === 'text');
    const raw = block && block.type === 'text' ? block.text : '';
    const jsonStr = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
    const result = JSON.parse(jsonStr) as { grounded: boolean; unsupported_claims: string[] };

    if (result.grounded) return answer;

    return "That specific figure is something I'd want to confirm before stating it -- I don't want to approximate a number that matters. It's best to ask me directly so I can give you the accurate detail. You can reach me via the Connect button on my profile.";
  } catch {
    // Validation failed (parse error, API error) -- let the original answer
    // through rather than break the chat experience.
    return answer;
  }
}
