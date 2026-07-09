import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';
import { anthropic } from '@/lib/ai/client';
import { CHAT_MODEL, GENERATION_MODEL } from '@/lib/ai/models';
import { buildCandidateSystemPrompt, REDIRECT_SENTINEL } from '@/lib/ai/build-system-prompt';
import { getCandidateBrainBySlug } from '@/lib/ai/get-candidate-brain';
import { ensureChatSession, logChatExchange } from '@/lib/ai/log-chat';
import { resolveEmployerViewer } from '@/lib/employer/resolve-viewer';
import { adminClient } from '@/lib/supabase/admin';
import { checkAppRateLimit } from '@/lib/security/rate-limit';
import { checkRateLimit } from '@vercel/firewall';
import { checkBotId } from 'botid/server';
import type { CandidateBrain } from '@/lib/types';

// Node runtime: the Anthropic SDK and service-role logging need Node APIs.
// This route is intentionally open to anonymous recruiters -- no Clerk session
// is required (CLAUDE.md reserves /api for callers without a Clerk session).
export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_HISTORY = 20;

// ── App-level interaction caps ─────────────────────────────────────────────────
// Durable, DB-backed ceilings that bound token burn regardless of the Vercel WAF
// (which is per-region and no-ops until its dashboard rule is published). Two
// dimensions, both generous enough that a real recruiter never trips them, both
// fail-open (an infra blip never blocks a live conversation), owner previews
// exempt. Backed by check_rate_limit() (lib/security/rate-limit.ts).
//   - Per chat: caps one conversation. A fresh chat resets it (the client offers
//     a one-tap restart), so a genuine long conversation is never dead-ended.
//   - Per IP: caps one source across all conversations, so a single-machine flood
//     is bounded even with no WAF rule configured. Set high enough to clear a
//     shared office IP (corporate NAT) while still stopping a script.
const MAX_MESSAGES_PER_CHAT = 40; // per hour, per session
const MAX_MESSAGES_PER_IP = 100; // per hour, per source IP

const ChatInput = z.object({
  candidateSlug: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  sessionId: z.string().uuid().optional(),
  // Optional recruiter self-introduction, captured before the first message.
  visitor: z
    .object({
      name: z.string().max(120).optional(),
      company: z.string().max(160).optional(),
      email: z.string().email().max(200).optional().or(z.literal('')),
    })
    .optional(),
  // Accepted for backward compatibility but IGNORED: history is rebuilt
  // server-side from chat_messages. A client-supplied history is untrusted --
  // fabricated assistant turns could plant "facts" the grounding rules would
  // then treat as conversation context.
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
  const { candidateSlug, message, sessionId: claimedSessionId, visitor } = parsed.data;
  const visitorName = visitor?.name?.trim() || null;
  const visitorCompany = visitor?.company?.trim() || null;
  const visitorEmail = (visitor?.email || '').trim() || null;

  // ── Abuse control ──────────────────────────────────────────────────────────
  // Edge rate limit (Vercel WAF) runs before the expensive brain load and up-to-
  // three Anthropic calls, so a flood is blocked before it costs compute.
  // Defaults to a per-IP bucket. No-ops until the matching WAF rule ("chat") is
  // published, so it is safe to ship ahead of it.
  // Recommended rule: 30 requests / 60s per IP (see docs/architecture/11-anti-spam.md).
  try {
    const { rateLimited } = await checkRateLimit('chat', { request: req });
    if (rateLimited) {
      return NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Too many messages just now. Please slow down and try again shortly.' } },
        { status: 429 },
      );
    }
  } catch (e) {
    // Fail-open: a limiter error must never block a real recruiter.
    console.error('chat: rate limit check failed', e);
  }

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

  // Bot check (Vercel BotID). Invisible for real recruiters; blocks automated
  // clients (Playwright/Puppeteer, scrapers). Skipped for the owner previewing
  // their own AI. Basic tier is free and active once deployed on Vercel; local
  // dev always reports not-a-bot. Fail-open on any error so a misconfiguration
  // never breaks the chat.
  if (!isOwner) {
    try {
      const verification = await checkBotId();
      if (verification.isBot) {
        return NextResponse.json(
          { error: { code: 'BOT_CHECK_FAILED', message: 'Could not verify you are human. Please reload and try again.' } },
          { status: 403 },
        );
      }
    } catch (e) {
      console.error('chat: botid check failed', candidateSlug, e);
    }
  }

  // Attribute a signed-in recruiter to their employer account/company, so the
  // candidate sees a real name and the employer transcripts view is populated.
  const employerViewer =
    userId && !isOwner ? await resolveEmployerViewer(userId) : null;

  // ── Session verification + server-side history ────────────────────────────
  // The sessionId is client-supplied, so it must be proven to belong to THIS
  // candidate before anything reads from or writes to it; a mismatched id is
  // treated as absent (a fresh session gets created at logging time).
  // Conversation history is rebuilt from chat_messages rather than trusted from
  // the client, so a fabricated assistant turn can never enter the prompt.
  let sessionId: string | undefined;
  let sessionIntro: { name: string | null; company: string | null } | null = null;
  if (claimedSessionId) {
    const { data: sess } = await (adminClient.from('chat_sessions') as any)
      .select('id, recruiter_name, employer_company_name, candidate_profile_id')
      .eq('id', claimedSessionId)
      .eq('candidate_profile_id', brain.candidateProfileId)
      .maybeSingle();
    if (sess) {
      sessionId = sess.id as string;
      const name = (sess.recruiter_name as string | null)?.trim() || null;
      const company = (sess.employer_company_name as string | null)?.trim() || null;
      if (name || company) sessionIntro = { name, company };
    }
  }

  let conversationHistory: { role: 'user' | 'assistant'; content: string }[] = [];
  if (sessionId) {
    // Both rows of an exchange are bulk-inserted with the same created_at, so
    // 'role' breaks the tie: descending created_at + ascending role puts the
    // assistant row first within a pair, which the reverse() below flips back
    // to user-before-assistant in chronological order.
    const { data: rows } = await (adminClient.from('chat_messages') as any)
      .select('role, content')
      .eq('chat_session_id', sessionId)
      .order('created_at', { ascending: false })
      .order('role', { ascending: true })
      .limit(MAX_HISTORY);
    conversationHistory = ((rows ?? []) as { role: 'user' | 'assistant'; content: string }[])
      .reverse()
      // The API requires alternating turns starting with 'user'; a partially
      // logged exchange could leave an assistant row first after the window cut.
      .filter((m, i, arr) => (i === 0 ? m.role === 'user' : m.role !== arr[i - 1].role));
  }

  // ── Interaction caps ───────────────────────────────────────────────────────
  // Bound token burn on the two dimensions the WAF can't durably express: a
  // single conversation and a single source IP. Both fail-open and both skip the
  // owner's own preview. A tripped cap returns a graceful, in-thread assistant
  // message (never an HTTP error), so the recruiter always has a next step: the
  // per-chat cap offers a restart; the per-IP cap offers a follow-up.
  const firstName = brain.candidate.full_name.split(' ')[0] || brain.candidate.full_name;
  if (!isOwner) {
    // Per-conversation cap first: a fresh chat resets it, so a heavy but genuine
    // single conversation gets the restart path rather than the harder IP wall.
    if (sessionId) {
      const withinChat = await checkAppRateLimit(`chat-session:${sessionId}`, MAX_MESSAGES_PER_CHAT, 3600);
      if (!withinChat) {
        return NextResponse.json({
          answer: `We've covered a lot of ground in this conversation. You can start a fresh chat to keep exploring, or leave your email and ${firstName} will follow up with you directly.`,
          sessionId,
          offerSchedule: true,
          degraded: 'session_limit',
        });
      }
    }

    // Per-source cap: bounds a single-machine flood even with no WAF rule live.
    const ip = getClientIp(req);
    if (ip) {
      const withinIp = await checkAppRateLimit(`chat-ip:${ip}`, MAX_MESSAGES_PER_IP, 3600);
      if (!withinIp) {
        return NextResponse.json({
          answer: `You've sent a lot of messages in a short time, so ${firstName}'s assistant is taking a brief pause. Please try again in a little while, or leave your email and ${firstName} will follow up with you directly.`,
          sessionId: sessionId ?? null,
          offerSchedule: true,
          degraded: 'rate_limited',
        });
      }
    }
  }

  // If the recruiter introduced themselves, the assistant addresses them by
  // name. Prefer the intro carried on this (first) message; otherwise the one
  // recorded on the verified session; otherwise fall back to a signed-in
  // employer's company. No intro -> generic greeting.
  let chatViewer: { name?: string | null; company?: string | null } | null = null;
  if (visitorName || visitorCompany) {
    chatViewer = { name: visitorName, company: visitorCompany };
  } else if (sessionIntro) {
    chatViewer = sessionIntro;
  } else if (employerViewer?.employerCompanyName) {
    chatViewer = { name: null, company: employerViewer.employerCompanyName };
  }

  const systemPrompt = buildCandidateSystemPrompt(
    brain.candidate,
    brain.resumeMarkdown,
    brain.careerContextMarkdown,
    chatViewer,
  );

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
      // The brain (resume + context doc + custom answers) is stable for the
      // whole session, so a cache breakpoint here makes every turn after the
      // first read the prompt at ~0.1x price with lower latency.
      system: [{ type: 'text' as const, text: systemPrompt, cache_control: { type: 'ephemeral' as const } }],
      messages: [
        ...conversationHistory.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: message },
      ],
    });
    // Guard the block type rather than blind-indexing content[0].
    const textBlock = response.content.find((b) => b.type === 'text');
    if (textBlock && textBlock.type === 'text') answer = textBlock.text.trim();
    // A max_tokens cutoff would otherwise end mid-sentence; trim back to the
    // last completed sentence so the recruiter never sees a broken reply.
    if (response.stop_reason === 'max_tokens') {
      answer = trimToLastSentence(answer);
    }
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
    answer = await validateAndSanitize(
      answer,
      brain.candidate,
      brain.resumeMarkdown,
      brain.careerContextMarkdown,
    );
  }

  // ── Honest redirect ────────────────────────────────────────────────────────
  // When the assistant cannot answer from the candidate's information (or the
  // grounding validator rejected an unsupported figure), the model emits the
  // sentinel. A small Haiku call writes a natural handoff that acknowledges the
  // specific question (stating no facts), so repeated deflections don't read as
  // the same canned paragraph; the scripted message is the fallback. The client
  // is told to offer scheduling. No plausible-but-unsupported answer ever
  // reaches the recruiter.
  let offerSchedule = false;
  if (answer.includes(REDIRECT_SENTINEL)) {
    offerSchedule = true;
    const first = brain.candidate.full_name.split(' ')[0] || brain.candidate.full_name;
    answer = await generateRedirectMessage(message, first);
  }

  // Owner self-tests are marked as sandbox so they don't pollute recruiter
  // analytics. Anonymous recruiter sessions log the viewer id when present.
  const resolvedSessionId = await ensureChatSession(brain.candidateProfileId, sessionId, {
    viewerClerkUserId: userId ?? null,
    employerAccountId: employerViewer?.employerAccountId ?? null,
    // Prefer a signed-in employer's company; otherwise the recruiter's own intro.
    employerCompanyName: employerViewer?.employerCompanyName ?? visitorCompany,
    recruiterName: visitorName,
    recruiterEmail: visitorEmail,
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

  return NextResponse.json({ answer, sessionId: resolvedSessionId ?? sessionId ?? null, offerSchedule });
}

/** The scripted, honest handoff; the fallback when the model-written one fails. */
function buildRedirectMessage(firstName: string): string {
  return `Great question, and an honest answer: I don't have that detail in what ${firstName} has shared with me. It's exactly the kind of thing ${firstName} would be glad to cover directly. Would you like to schedule a time to talk with ${firstName}?`;
}

/**
 * Writes a natural, varied handoff for a question the assistant cannot answer.
 * The model is forbidden from stating any fact; its only job is to acknowledge
 * the specific question warmly and offer the direct conversation. Falls back to
 * the scripted message on any failure.
 */
async function generateRedirectMessage(question: string, firstName: string): Promise<string> {
  try {
    const response = await anthropic.messages.create({
      model: CHAT_MODEL,
      max_tokens: 150,
      system: `You write a short, warm handoff reply for ${firstName}'s career assistant when it cannot answer a recruiter's question from ${firstName}'s information.

Rules, all strict:
- 2 to 3 sentences. Acknowledge the specific topic of the question naturally, then say honestly that you don't have that detail, and offer to set up a time to talk with ${firstName} directly.
- State NO facts about ${firstName} whatsoever: no numbers, no history, no claims, no guesses. You know nothing except that the detail is not available to you.
- Sound like a thoughtful human assistant, not a bot. No apology theater, no corporate filler.
- Never use em dashes ("--" or the long dash). Use commas, semicolons, or periods instead.`,
      messages: [{ role: 'user', content: `The recruiter asked: "${question}"\n\nWrite the handoff reply.` }],
    });
    const block = response.content.find((b) => b.type === 'text');
    const text = block && block.type === 'text' ? block.text.trim() : '';
    // Guard: if the model produced something empty or suspiciously long, fall back.
    if (text && text.length <= 600) return text;
    return buildRedirectMessage(firstName);
  } catch (e) {
    console.error('chat: redirect generation failed', e);
    return buildRedirectMessage(firstName);
  }
}

/**
 * Best-effort client IP for the per-source interaction cap. On Vercel the real
 * client is the first entry in x-forwarded-for; x-real-ip is the fallback. A
 * missing IP simply skips the per-IP cap (fail-open) rather than blocking.
 */
function getClientIp(req: NextRequest): string | null {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim() || null;
  return req.headers.get('x-real-ip');
}

/** Trims a max_tokens-truncated answer back to its last completed sentence. */
function trimToLastSentence(answer: string): string {
  const lastEnd = Math.max(answer.lastIndexOf('.'), answer.lastIndexOf('!'), answer.lastIndexOf('?'));
  if (lastEnd > 0) return answer.slice(0, lastEnd + 1);
  return answer;
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
  careerContextMarkdown: string | null = null,
): Promise<string> {
  const careerData = [
    careerContextMarkdown,
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

Task: Does every specific number, dollar figure, percentage, multiplier, year, certification, or credential mentioned in the answer appear explicitly in the career data above? Submit the verdict via the submit_validation tool.`;

  try {
    // Forced tool call, same pattern as every other structured call in lib/ai,
    // so a chatty preamble or markdown fence can never break the parse.
    const validation = await anthropic.messages.create({
      model: GENERATION_MODEL,
      max_tokens: 300,
      tools: [
        {
          name: 'submit_validation',
          description: 'Submit the grounding verdict for the answer.',
          input_schema: {
            type: 'object' as const,
            properties: {
              grounded: { type: 'boolean' },
              unsupported_claims: { type: 'array', items: { type: 'string' } },
            },
            required: ['grounded', 'unsupported_claims'],
            additionalProperties: false,
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'submit_validation' },
      messages: [{ role: 'user', content: validationPrompt }],
    });

    const block = validation.content.find((b) => b.type === 'tool_use');
    if (!block || block.type !== 'tool_use') return answer;
    const result = block.input as { grounded: boolean; unsupported_claims: string[] };

    if (result.grounded) return answer;

    // Ungrounded figure: route to the honest redirect rather than approximating.
    return REDIRECT_SENTINEL;
  } catch {
    // Validation failed (API error) -- let the original answer through rather
    // than break the chat experience.
    return answer;
  }
}
