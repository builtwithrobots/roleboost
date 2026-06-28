# 04 — The AI Brain

The candidate career AI is a **single Claude call with a layered, XML-structured
system prompt**. No fine-tuning, no embeddings, no vector DB. Each chat session
loads exactly one candidate's prompt, built from exactly one
`candidate_profiles` record — brains are structurally isolated, never aggregated.

## What feeds the brain (and what doesn't)

Assembled by `getCandidateBrainBySlug` (`lib/ai/get-candidate-brain.ts`), read
server-side via the service-role client:

1. **`candidate_profiles` brain columns** — the eight career-context fields,
   `custom_qa_pairs`, `redirect_topics`, identity, `ai_enabled`, `is_published`.
2. **`resume_documents.canonical_markdown`** — the résumé text, passed to the
   builder as a *separate argument*. There is **no `resume_text` column**.
3. **`context_package_md`** — the active [career context document](./05-career-context-document.md).
4. **The selected context-document angle's hard-question Q/A** is **promoted into
   `custom_qa_pairs`** (deduped against the candidate's own pairs) so it inherits
   highest-priority + few-shot treatment.

What does **not** reach the live prompt: `candidate_assets` (audio/video/etc. are
recruiter-facing media, not brain text) and `career_sources` raw text (those feed
the *intake interview* and *context-document generation*, not every chat turn).

`getCandidateBrainBySlug` returns `{ candidateProfileId, ownerClerkUserId,
isPublished, aiEnabled, candidate, resumeMarkdown, careerContextMarkdown }`. It
returns a profile even when unpublished/AI-off so the **owner can preview**; the
caller gates visibility.

## The layered system prompt

`lib/ai/build-system-prompt.ts` →
`buildCandidateSystemPrompt(candidate, resumeMarkdown, careerContextMarkdown)`.
Philosophy: **data near the top, rules near the bottom.** Order:

1. `<role>` — first-person identity ("I", "my"); not a FAQ bot.
2. `<career_context_document>` — *(when present)* the professionally synthesized
   narrative, placed first for primacy; the résumé below is the factual backstop.
   Omitted entirely when there is no document.
3. `<career_information>` — full résumé markdown.
4. `<context>` — the named career-context fields (target role, leadership
   philosophy, key wins, departures, challenge, environment, manager needs,
   weaknesses, wish-questions, additional context).
5. `<custom_answers priority="highest">` — candidate-refined QA pairs (plus the
   promoted hard question); used before anything else.
6. `<few_shot_examples>` — up to 3 worked exemplars drawn from the custom QA.
7. `<knowledge_boundary>` — explicit known / not-known / when-not-known. The
   strongest hallucination guard; it lists the document and résumé as "known" and
   names what is off-limits (salary, references, anything not in the data).
8. `<principles>` — honesty, calm confidence, human warmth.
9. `<adversarial_posture>` — how to handle skeptical / pressure-testing questions.
10. `<redirect_topics>` — topics routed to a direct human conversation.
11. `<voice>` — tone derived from the candidate's own writing samples.
12. `<reasoning_instruction>` — synthesis across the whole picture; numeric grounding.

## The chat call (`app/api/chat/route.ts`)

1. Zod-validate input (`candidateSlug`, `message`, `sessionId?`, up to 20 history
   turns).
2. `getCandidateBrainBySlug`; 404 if missing or `ai_enabled = false`.
3. **Visibility:** anonymous recruiters may only chat with published profiles; the
   owner (authenticated) may preview their own unpublished AI.
4. **Complexity router** — `detectComplexQuestion(message)`, a fast string
   heuristic (no API call): adversarial phrasing, multi-fact synthesis, or
   multi-clause questions route to **Sonnet** (`GENERATION_MODEL`); everything else
   stays on **Haiku** (`CHAT_MODEL`). It errs toward Sonnet — a false positive
   costs cents, a false negative costs answer quality.
5. Single `anthropic.messages.create` (max 500 tokens, **no streaming** — see
   below) with the assembled system prompt + history + message.
6. **Post-generation grounding validation** — runs *only* when the answer contains
   high-risk content (`detectHighRiskContent`: dollars, percentages, multipliers,
   four-digit numbers, or credential keywords). `validateAndSanitize` makes a fast
   Sonnet call asking whether every such claim traces to the candidate's data;
   that grounding set includes the **career context document**, résumé, all brain
   fields, and custom QA. If not grounded, the answer is replaced with a natural
   deflection. **Fail-safe:** any error returns the original answer rather than
   breaking the chat.
7. Log the turn (see [07](./07-chat-and-transcripts.md)).

**No token streaming** is deliberate — it conflicts with the post-generation
validation pass, which needs the whole answer before it can ground-check it.

## Per-turn tracking

Each assistant `chat_messages` row records `model_used`, `was_complex`, and
`was_validated`, so cost and routing behavior are observable. Blended cost is
roughly $0.01 per 10-turn session.

## Where the brain is also used

The same `buildCandidateSystemPrompt` powers the **sandbox** self-test
(`/api/sandbox/analyze`) so the candidate tests exactly what a recruiter would
hit. The brain assembly is also read (without building the chat prompt) by the
transcript-deliver and hardening flows for gap analysis.

## Model split (`lib/ai/models.ts`)

| Constant | Model | Use |
|---|---|---|
| `CHAT_MODEL` | `claude-haiku-4-5-20251001` | Live recruiter chat; sandbox answer generation |
| `GENERATION_MODEL` | `claude-sonnet-4-6` | All one-time generation/analysis: prompt/context generation, intake, sandbox analysis, transcript gap analysis, hardening, role recommendation, grounding validation |

IDs are imported from this file everywhere — never hardcoded. The Anthropic client
(`lib/ai/client.ts`) is a lazy server-only singleton; the key never reaches the
browser.
