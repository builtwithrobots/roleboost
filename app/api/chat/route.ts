import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';
import { anthropic } from '@/lib/ai/client';
import { CHAT_MODEL } from '@/lib/ai/models';
import { buildCandidateSystemPrompt } from '@/lib/ai/build-system-prompt';
import { getCandidateBrainBySlug } from '@/lib/ai/get-candidate-brain';
import { ensureChatSession, logChatExchange } from '@/lib/ai/log-chat';

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

  let answer = '';
  try {
    const response = await anthropic.messages.create({
      model: CHAT_MODEL,
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

  // Owner self-tests are marked as sandbox so they don't pollute recruiter
  // analytics. Anonymous recruiter sessions log the viewer id when present.
  const resolvedSessionId = await ensureChatSession(brain.candidateProfileId, sessionId, {
    viewerClerkUserId: userId ?? null,
    isSandbox: isOwner,
  });
  if (resolvedSessionId) {
    await logChatExchange({ sessionId: resolvedSessionId, question: message, answer });
  }

  return NextResponse.json({ answer, sessionId: resolvedSessionId ?? sessionId ?? null });
}
