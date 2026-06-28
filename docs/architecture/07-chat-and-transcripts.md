# 07 — Chat & Transcripts

## Live chat (`app/api/chat/route.ts`)

The recruiter-facing endpoint. Open to **anonymous** callers (no Clerk session) —
that is why it reads via the service-role client and enforces visibility itself.
Full flow (router, grounding validation, no-streaming rationale) is in
[04 — The AI Brain](./04-ai-brain.md). Summary:

```
POST /api/chat { candidateSlug, message, sessionId?, conversationHistory? }
  → getCandidateBrainBySlug (service-role read)
  → 404 if missing / ai_enabled=false; visibility: published OR owner-preview
  → detectComplexQuestion → Haiku or Sonnet
  → buildCandidateSystemPrompt(candidate, resumeMarkdown, careerContextMarkdown)
  → answer (max 500 tokens, no streaming)
  → if detectHighRiskContent → validateAndSanitize (grounding; fail-safe)
  → log the turn → { answer, sessionId }
```

## Chat logging (`lib/ai/log-chat.ts`)

Service-role, **best-effort** (a logging failure must never break the recruiter's
reply):
- `ensureChatSession(candidateProfileId, sessionId?, viewer)` — creates or reuses a
  `chat_sessions` row. Anonymous recruiters log `viewer_clerk_user_id = null`;
  owner self-tests are marked `is_sandbox = true` so they don't pollute analytics.
- `logChatExchange({ sessionId, question, answer, modelUsed, wasComplex,
  wasValidated })` — writes the user + assistant `chat_messages`, stamping the
  per-turn tracking fields.

## Transcript delivery (`app/api/transcripts/deliver/route.ts`)

When the chat closes (or after 30 min inactivity), the client fires a
`sendBeacon` to `POST /api/transcripts/deliver`.

- **Idempotent** — guarded by `chat_sessions.transcript_sent`; the flag is set up
  front so duplicate beacons no-op.
- Emails **both sides** via Resend (`lib/email/client.ts`, templates in
  `lib/email/transcript.ts`; both server-only). The candidate email includes the
  full transcript, company name (if the recruiter was logged in), pattern insights
  at 3+ same-topic questions, and a fine-tune link; the employer email includes the
  transcript, profile link, and save-candidate + feedback CTAs.

## Transcript → brain gap loop (`lib/ai/analyze-transcript.ts`)

After delivery, the route fires gap analysis (async, best-effort — it never fails
the email):
- `analyzeTranscriptGaps({ candidate, resumeMarkdown, messages })` (Sonnet, forced
  tool output) returns up to 5 gaps, each typed `deflection` / `weak` /
  `new_topic` with a ready-to-show `suggested_prompt`, `category`, and `priority`.
- Gaps persist to `transcript_gaps`. **Pattern detection:** when a category recurs
  (3+), priority is raised to `high` and `pattern_count` reflects frequency.
- These surface in AI Studio's prompt bot (see [06](./06-ai-studio.md)). The raw
  transcript is not persisted as a record beyond the chat messages already logged.

## The growth loop

```
recruiter chats → transcript emailed → gaps mined (transcript_gaps)
   → prompt bot surfaces expansion prompts → candidate strengthens a field
   → brain improves → next recruiter gets a better answer  ↺
```

This is the retention mechanism: the brain compounds with use, and the accumulated
career intelligence is the switching cost. The sandbox and external-transcript
hardening feed the same loop from predicted and real questions respectively.
