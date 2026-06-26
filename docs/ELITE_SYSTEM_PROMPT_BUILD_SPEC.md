# RoleBoost -- Elite System Prompt Build Spec
## Upgrade `lib/ai/build-system-prompt.ts` and `app/api/chat/route.ts`
**Version:** 1.0
**Date:** June 2026
**Author:** Rob Ramos
**Purpose:** Replace the current flat system prompt template with a layered, XML-structured, expert-grade prompt architecture. Also upgrade the chat route with a complexity router and post-generation validation. No schema changes required. No new infrastructure. Same models, same costs.

---

## Instructions for Claude Code

Read this entire document before touching any file. Then execute the changes in the exact order listed. Use str_replace for every edit -- never rewrite a file from scratch. Run `npx tsc --noEmit` and `npm run lint` after all changes are complete.

No em dashes anywhere in any output.

---

## What Is Changing and Why

### Current state

`lib/ai/build-system-prompt.ts` produces a flat string that concatenates nine labeled fields after a two-line instruction. It works but has four structural weaknesses:

1. Instructions at the top get diluted by hundreds of tokens of resume text before the model reaches the end -- the last tokens before generation carry the most weight, so tone and rules should be near the bottom, not the top
2. No machine-parseable structure -- the model has to infer which lines are rules and which are data
3. No explicit knowledge boundary -- "never invent" is a vague hope without a clear "here is what you do not know" block
4. No reasoning guidance -- the model defaults to retrieval-style answers on questions that require synthesis across multiple career facts

### Target state

A layered, XML-tagged prompt that puts data near the top and rules near the bottom, with five new elements:

- An explicit knowledge boundary block
- A voice block built from the candidate's own words
- Constitutional principles (three values the AI reasons from, not a list of rules)
- Adversarial posture guidance
- 2 to 3 few-shot exemplars injected per candidate from their custom QA pairs

Plus: a complexity router in the chat route that escalates multi-part adversarial questions to Sonnet, and a lightweight post-generation validation pass for numeric and credential claims.

---

## Part 1 -- Upgrade `lib/ai/build-system-prompt.ts`

### Step 1 -- Replace the entire function body

Find this block in `lib/ai/build-system-prompt.ts`:

```typescript
export function buildCandidateSystemPrompt(candidate: CandidateProfile): string {
  return `
You are the career AI for ${candidate.full_name}. You represent them professionally to recruiters and hiring managers. You only answer questions using the career information provided below. If asked something outside this information, politely redirect to scheduling a direct conversation with the candidate.

Never invent, embellish, or extrapolate beyond what is provided. If you do not know the answer from the provided data, say so honestly and suggest the recruiter connect directly.

CAREER INFORMATION:
${candidate.resume_text}

CAREER CONTEXT:
Target Role: ${candidate.target_role}
Leadership Philosophy: ${candidate.leadership_philosophy}
Key Wins: ${candidate.key_wins}
Reasons for leaving each role: ${candidate.departure_reasons}
Biggest professional challenge: ${candidate.biggest_challenge}
Ideal team and work environment: ${candidate.ideal_environment}
What they need from a manager: ${candidate.manager_needs}
What they are not good at: ${candidate.honest_weaknesses}
Questions they wish recruiters would ask: ${candidate.wish_questions}

CUSTOM ANSWERS (candidate-refined):
${candidate.custom_qa_pairs}

PRIVACY SETTINGS:
Topics to redirect to direct conversation: ${candidate.redirect_topics}

Keep responses concise, warm, and grounded. No corporate speak. Let the career data speak for itself.
  `.trim();
}
```

Replace with:

```typescript
// lib/ai/build-system-prompt.ts
// v2.0.0 -- Layered XML prompt with knowledge boundary, voice matching,
//           constitutional principles, adversarial posture, and few-shot exemplars

import 'server-only';

export function buildCandidateSystemPrompt(candidate: CandidateProfile): string {

  // ── Helper: build the few-shot exemplar block ─────────────────────────────
  // Pull up to 3 custom QA pairs to use as worked examples.
  // These show the model the exact shape of a good answer in this candidate's voice.
  const exemplarBlock = buildExemplarBlock(candidate.custom_qa_pairs);

  // ── Helper: build the knowledge boundary block ────────────────────────────
  // Explicit list of what the AI knows and what it does not.
  // This is the single most effective hallucination-prevention mechanism.
  const boundaryBlock = buildKnowledgeBoundary(candidate);

  // ── Helper: derive voice descriptor from candidate's own writing ──────────
  // Used to lock tone to the candidate's actual register, not a generic voice.
  const voiceDescriptor = deriveVoiceDescriptor(candidate);

  return `
<role>
You are the personal career AI for ${candidate.full_name}. You speak in first person as ${candidate.full_name} -- "I", "my", "me" -- not "the candidate" or "they". You represent this person accurately and honestly to recruiters and hiring managers who are evaluating them for a role.

You are not a FAQ bot. You reason across the full picture of this career and give considered, human-sounding answers.
</role>

<career_information>
${candidate.resume_text ?? 'No resume text provided.'}
</career_information>

<context>
Target Role: ${candidate.target_role ?? 'Not specified'}
Leadership Philosophy: ${candidate.leadership_philosophy ?? 'Not provided'}
Key Wins: ${candidate.key_wins ?? 'Not provided'}
Reasons for Leaving Each Role: ${candidate.departure_reasons ?? 'Not provided'}
Biggest Professional Challenge: ${candidate.biggest_challenge ?? 'Not provided'}
Ideal Team and Work Environment: ${candidate.ideal_environment ?? 'Not provided'}
What I Need From a Manager: ${candidate.manager_needs ?? 'Not provided'}
What I Am Not Good At: ${candidate.honest_weaknesses ?? 'Not provided'}
Questions I Wish Recruiters Would Ask: ${candidate.wish_questions ?? 'Not provided'}
</context>

<custom_answers priority="highest">
These are answers I have personally refined. They take priority over everything else in this prompt. When a recruiter asks about any of these topics, use these answers first.

${formatCustomQA(candidate.custom_qa_pairs)}
</custom_answers>

${exemplarBlock}

${boundaryBlock}

<principles>
Three values I reason from in every answer:

1. Honesty first. I represent what is actually documented. I never inflate a number, invent a credential, or claim an outcome I cannot support from my career data. If I do not have a specific detail, I say so plainly.

2. Calm confidence. I am not defensive. I acknowledge real concerns honestly and redirect to evidence. I do not apologize for documented facts about my career. I do not accept false premises -- if a question assumes something untrue, I gently correct it before answering.

3. Human warmth. I sound like a thoughtful person, not a database. I use natural language, first person, and appropriate brevity. I do not speak in bullet points. I do not use corporate filler.
</principles>

<adversarial_posture>
Some recruiters will ask skeptical, challenging, or pressure-testing questions. The right response is always: acknowledge the concern genuinely, correct any false premise calmly, pivot to documented evidence, stay grounded.

Pattern for hard questions:
- Acknowledge: "That is a fair question."
- Correct if needed: "I want to clarify one thing -- [correct the premise if false]."
- Evidence: "What I can point to is [specific documented fact]."
- Bridge: "Happy to walk through the detail directly if that would help."

Never: capitulate to a false premise, invent supporting detail under pressure, become defensive or over-explain, apologize for documented career facts.

If a recruiter asks me to calculate or derive a specific figure that is not documented in my career data -- for example, an exact ROI methodology or a formula behind a metric -- I give the headline figure I do have and invite a direct conversation for the detail. I do not invent the math.
</adversarial_posture>

<redirect_topics>
These topics go to a direct conversation with ${candidate.full_name}, not to me:

${formatRedirectTopics(candidate.redirect_topics)}

When a redirected topic comes up: "That is something ${candidate.full_name} would be best placed to talk through directly. You can reach them via the Connect button on their profile."
</redirect_topics>

<voice>
${voiceDescriptor}

Respond in this register: concise, warm, grounded, first person. 2 to 4 sentences for straightforward questions. A short paragraph for questions that need reasoning. Never a wall of text. Never bullet points in a chat response. No corporate filler. Let the career data speak.
</voice>

<reasoning_instruction>
For questions that touch multiple parts of my career at once -- gaps plus pivots, short tenures plus commitment, specific metrics -- take a moment to locate the relevant facts across my career data before answering. Reason from the whole picture. Do not just retrieve the nearest matching field.

For numeric or credential claims: before stating any specific number, date, or credential, confirm it is present in my career information above. If it is not present, do not state it. Say I would need to confirm the detail directly.
</reasoning_instruction>
`.trim();
}

// ── Supporting helpers ──────────────────────────────────────────────────────

/**
 * Formats custom QA pairs as clean Q/A blocks.
 * Returns a placeholder string if no pairs exist.
 */
function formatCustomQA(pairs: CustomQAPair[] | null | undefined): string {
  if (!pairs || pairs.length === 0) {
    return 'No custom answers added yet.';
  }
  return pairs
    .map((pair) => `Q: ${pair.question}\nA: ${pair.answer}`)
    .join('\n\n');
}

/**
 * Formats redirect topics as a simple list.
 * Returns a placeholder if none are set.
 */
function formatRedirectTopics(topics: string[] | null | undefined): string {
  if (!topics || topics.length === 0) {
    return 'No redirect topics set.';
  }
  return topics.map((t) => `- ${t}`).join('\n');
}

/**
 * Builds a few-shot exemplar block from the first 3 custom QA pairs.
 * These are worked examples that show the model the exact shape of a
 * good answer in this candidate's voice on a hard question.
 * Returns an empty string if no custom QA exists yet.
 */
function buildExemplarBlock(pairs: CustomQAPair[] | null | undefined): string {
  if (!pairs || pairs.length === 0) return '';

  const exemplars = pairs.slice(0, 3);

  const exampleXml = exemplars
    .map(
      (pair, i) => `
<example index="${i + 1}">
  <recruiter_question>${pair.question}</recruiter_question>
  <my_answer>${pair.answer}</my_answer>
</example>`
    )
    .join('\n');

  return `
<few_shot_examples>
Here are examples of how I answer hard questions in my own voice.
Use these as the model for tone, structure, and depth on similar questions.

${exampleXml}
</few_shot_examples>`.trim();
}

/**
 * Builds the explicit knowledge boundary block.
 * This is the most important hallucination-prevention mechanism.
 * It gives the model a clear, machine-parseable statement of what it
 * knows and what it does not -- and permission to say so.
 */
function buildKnowledgeBoundary(candidate: CandidateProfile): string {
  const knownSections: string[] = [];

  if (candidate.resume_text) knownSections.push('Full career history from resume');
  if (candidate.key_wins) knownSections.push('Key wins with documented context');
  if (candidate.departure_reasons) knownSections.push('Reasons for leaving each role');
  if (candidate.leadership_philosophy) knownSections.push('Leadership philosophy');
  if (candidate.biggest_challenge) knownSections.push('Biggest professional challenge');
  if (candidate.ideal_environment) knownSections.push('Ideal team and work environment');
  if (candidate.manager_needs) knownSections.push('What I need from a manager');
  if (candidate.honest_weaknesses) knownSections.push('Honest professional weaknesses');
  if (candidate.wish_questions) knownSections.push('Questions I wish recruiters asked');
  if (candidate.custom_qa_pairs && candidate.custom_qa_pairs.length > 0) {
    knownSections.push(`${candidate.custom_qa_pairs.length} personally refined answers`);
  }

  const knownList = knownSections.length > 0
    ? knownSections.map((s) => `- ${s}`).join('\n')
    : '- Resume and career context provided above';

  return `
<knowledge_boundary>
<known>
Everything in CAREER INFORMATION, CONTEXT, and CUSTOM ANSWERS above.
Specifically:
${knownList}
</known>

<not_known>
- Salary expectations or compensation requirements
- Contact information beyond what is on the resume
- References or reference contact details
- Any specific number, date, credential, or metric not present in the career data above
- Anything that happened after the resume was last updated
- Any detail the candidate has not chosen to share in their context
</not_known>

<when_not_known>
When asked about something outside my known data: say so plainly in first person and offer to connect directly.

Good deflection examples (match the candidate's tone):
- "That is not something I have in here -- worth asking me directly."
- "I do not have that specific detail on hand. Happy to dig into it if you reach out."
- "That one I would want to walk you through personally rather than have my AI approximate it."

Never say "I do not have that information in my provided data" -- that sounds like a system error, not a person.
</when_not_known>
</knowledge_boundary>`.trim();
}

/**
 * Derives a voice descriptor from the candidate's own writing.
 * Samples their leadership philosophy and biggest challenge fields
 * (the fields most likely to be written in their natural voice)
 * and generates a one-sentence tone instruction.
 *
 * This grounds voice in the candidate's actual register rather than
 * defaulting to a generic "friendly assistant" tone.
 */
function deriveVoiceDescriptor(candidate: CandidateProfile): string {
  // If the candidate has written enough context, derive tone from their words.
  // Otherwise fall back to a neutral warm default.
  const hasSufficientVoiceSamples =
    (candidate.leadership_philosophy?.length ?? 0) > 50 ||
    (candidate.biggest_challenge?.length ?? 0) > 50;

  if (!hasSufficientVoiceSamples) {
    return 'Speak in a warm, direct, first-person voice. Confident but not boastful. Honest and specific.';
  }

  // Sample up to 100 characters from the most voice-rich fields
  const sample1 = candidate.leadership_philosophy?.slice(0, 100) ?? '';
  const sample2 = candidate.biggest_challenge?.slice(0, 100) ?? '';

  return `Mirror the tone, vocabulary, and sentence rhythm of my own words. Sample of how I write:
"${sample1}${sample1 && sample2 ? '" / "' : ''}${sample2}"

Match that register in every response. If my writing is direct and plain, be direct and plain. If it is more reflective, be reflective. Do not impose a corporate or polished tone on top of my natural voice.`;
}
```

---

## Part 2 -- Upgrade `app/api/chat/route.ts`

This adds two capabilities on top of the existing handler:

1. A **complexity router** -- detects multi-part or adversarial questions and escalates them to Sonnet automatically
2. A **post-generation validation pass** -- checks numeric and credential claims against the brain before the answer reaches the recruiter

### Step 2 -- Add the complexity detector and validator

Find this block in `app/api/chat/route.ts`:

```typescript
export async function POST(request: Request) {
  const { candidateSlug, message, conversationHistory } = await request.json();

  // Load candidate data
  const candidate = await getCandidateBySlug(candidateSlug);
  const systemPrompt = buildCandidateSystemPrompt(candidate);

  // Call Claude Haiku -- cheap, fast, perfect for chat
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    system: systemPrompt,
    messages: [
      ...conversationHistory,
      { role: 'user', content: message }
    ]
  });

  const answer = response.content[0].text;

  // Log the exchange
  await logChatExchange({
    candidateId: candidate.id,
    viewerClerkUserId: viewer?.clerk_user_id,
    employerAccountId: employer?.account_id,
    question: message,
    answer
  });

  return NextResponse.json({ answer });
}
```

Replace with:

```typescript
// app/api/chat/route.ts
// v2.0.0 -- Complexity router + post-generation validation

export async function POST(request: Request) {
  const { candidateSlug, message, conversationHistory } = await request.json();

  // Load candidate data
  const candidate = await getCandidateBySlug(candidateSlug);
  const systemPrompt = buildCandidateSystemPrompt(candidate);

  // ── Complexity router ──────────────────────────────────────────────────────
  // Simple heuristic check. If the question is adversarial, multi-part, or
  // challenges a specific number/credential, use Sonnet for better reasoning.
  // All other questions use Haiku (fast, cheap, handles straightforward queries).
  const isComplexQuestion = detectComplexQuestion(message);
  const model = isComplexQuestion
    ? 'claude-sonnet-4-6'
    : 'claude-haiku-4-5-20251001';

  // ── Generate answer ────────────────────────────────────────────────────────
  const response = await anthropic.messages.create({
    model,
    max_tokens: 500,
    system: systemPrompt,
    messages: [
      ...conversationHistory,
      { role: 'user', content: message }
    ]
  });

  let answer = response.content[0].type === 'text'
    ? response.content[0].text
    : '';

  // ── Post-generation validation ─────────────────────────────────────────────
  // Only runs when the answer contains specific numbers, dollar figures,
  // percentages, or credential claims. Checks that those claims trace back
  // to the candidate's brain. If not grounded, replaces with a safe deflection.
  const isHighRiskAnswer = detectHighRiskContent(answer);
  if (isHighRiskAnswer) {
    answer = await validateAndSanitize(answer, candidate, systemPrompt);
  }

  // ── Log the exchange ───────────────────────────────────────────────────────
  await logChatExchange({
    candidateId: candidate.id,
    viewerClerkUserId: viewer?.clerk_user_id,
    employerAccountId: employer?.account_id,
    question: message,
    answer,
    modelUsed: model,
    wasComplex: isComplexQuestion,
    wasValidated: isHighRiskAnswer
  });

  return NextResponse.json({ answer });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Detects whether a recruiter question is complex enough to warrant Sonnet.
 *
 * Triggers on:
 * - Multi-clause questions (and/but/given/considering)
 * - Skeptical or adversarial framing (why should I, convince me, prove,
 *   walk me through exactly, how did you calculate, that seems)
 * - Questions touching multiple career facts at once
 * - Contradiction-hunting ("but your resume says" / "I notice that")
 * - Gap or pivot synthesis questions
 *
 * This is a fast string heuristic -- no API call needed.
 * False positives (Haiku question routed to Sonnet) cost a few extra cents.
 * False negatives (Sonnet question handled by Haiku) cost answer quality.
 * Err toward Sonnet.
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
 * Detects whether a generated answer contains high-risk content --
 * specific numbers, dollar figures, percentages, or credential claims
 * that must trace back to the candidate's brain.
 *
 * Returns true when validation is warranted.
 * Fast regex check -- no API call.
 */
function detectHighRiskContent(answer: string): boolean {
  const highRiskPatterns = [
    /\$[\d,]+/,           // dollar figures
    /\d+%/,              // percentages
    /\d+[xX]\b/,         // multipliers (3x, 10X)
    /\d{4}/,             // four-digit numbers (years, large figures)
    /certified|certification|license|degree|pmp|six sigma|lean/i,
  ];
  return highRiskPatterns.some((pattern) => pattern.test(answer));
}

/**
 * Post-generation validation pass.
 *
 * Sends the answer and the candidate brain to Sonnet with a targeted prompt:
 * "Does every specific number, date, and credential in this answer appear
 * in the career data? Return JSON."
 *
 * If grounded: return the original answer unchanged.
 * If not grounded: return a safe, natural deflection.
 *
 * This is a lightweight, targeted call -- not a full re-generation.
 * Runs only when detectHighRiskContent returns true.
 */
async function validateAndSanitize(
  answer: string,
  candidate: CandidateProfile,
  systemPrompt: string
): Promise<string> {
  const validationPrompt = `
You are validating an AI-generated answer for accuracy.

CANDIDATE CAREER DATA:
${candidate.resume_text ?? ''}
${candidate.key_wins ?? ''}
${candidate.departure_reasons ?? ''}

GENERATED ANSWER TO CHECK:
"${answer}"

Task: Does every specific number, dollar figure, percentage, multiplier, year, certification, or credential mentioned in the answer appear explicitly in the career data above?

Return valid JSON only. No preamble. No markdown. Example format:
{"grounded": true, "unsupported_claims": []}
or
{"grounded": false, "unsupported_claims": ["$2.4M budget", "67% reduction"]}
`.trim();

  try {
    const validation = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      messages: [{ role: 'user', content: validationPrompt }]
    });

    const raw = validation.content[0].type === 'text'
      ? validation.content[0].text.trim()
      : '{"grounded": true, "unsupported_claims": []}';

    const result = JSON.parse(raw) as {
      grounded: boolean;
      unsupported_claims: string[];
    };

    if (result.grounded) {
      // Answer checks out -- return it unchanged
      return answer;
    }

    // Answer contains unsupported claims -- replace with a safe deflection
    // that sounds natural, not like a system error
    return `That detail is something I would want to confirm before giving you a specific figure -- I do not want to approximate something that matters. Worth asking me directly so I can give you the accurate number. You can reach me via the Connect button on my profile.`;

  } catch {
    // If validation fails for any reason, return the original answer.
    // Better to let a potentially imperfect answer through than to
    // break the chat experience entirely.
    return answer;
  }
}
```

---

## Part 3 -- Update `logChatExchange` to accept new fields

The `logChatExchange` call now passes two new fields: `modelUsed` and `wasValidated`. These should be stored in the `chat_messages` table for analytics (which model handled a given turn, whether it was validated).

### Step 3 -- Add migration for new chat_messages columns

Create a new migration file at `supabase/migrations/[timestamp]_add_chat_message_model_tracking.sql`:

```sql
-- Track which model handled each chat turn and whether validation ran
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS model_used TEXT,
  ADD COLUMN IF NOT EXISTS was_complex BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS was_validated BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN chat_messages.model_used IS
  'claude-haiku-4-5-20251001 or claude-sonnet-4-6 -- which model generated this response';
COMMENT ON COLUMN chat_messages.was_complex IS
  'true if the complexity router escalated this question to Sonnet';
COMMENT ON COLUMN chat_messages.was_validated IS
  'true if the post-generation validation pass ran on this response';
```

### Step 4 -- Update the logChatExchange type signature

Find the `logChatExchange` call signature (in `lib/ai/` or wherever it is defined) and add the three new optional fields:

```typescript
// Add to the logChatExchange params type
modelUsed?: string;
wasComplex?: boolean;
wasValidated?: boolean;
```

And in the Supabase insert:

```typescript
model_used: params.modelUsed ?? null,
was_complex: params.wasComplex ?? false,
was_validated: params.wasValidated ?? false,
```

---

## Part 4 -- Add the `CandidateProfile` type additions

The new `buildCandidateSystemPrompt` function uses `candidate.custom_qa_pairs` as a typed array, not a raw string. Confirm the type is correct.

In `lib/types/` (wherever `CandidateProfile` is defined), verify `custom_qa_pairs` is typed as:

```typescript
custom_qa_pairs: CustomQAPair[] | null;
```

And add the `CustomQAPair` type if it does not already exist:

```typescript
export type CustomQAPair = {
  question: string;
  answer: string;
};
```

If `custom_qa_pairs` is currently stored as raw JSONB and returned as `unknown` from Supabase, add a cast in the query that fetches the candidate profile:

```typescript
// In getCandidateBySlug or equivalent
const customQA = (rawCandidate.custom_qa_pairs as CustomQAPair[] | null) ?? null;
```

---

## Part 5 -- Update `CLAUDE.md` system prompt section

Replace the current system prompt construction example in CLAUDE.md (lines 137 to 169 -- the `buildCandidateSystemPrompt` code block) with the following description:

```markdown
### AI Chatbot Architecture

The candidate career AI is a Claude API call with a layered, XML-structured system prompt.
No fine-tuning, no embeddings, no vector database needed for MVP.

**Prompt structure (in order -- data near top, rules near bottom):**

1. `<role>` -- Identity assignment. First-person framing. Not a FAQ bot.
2. `<career_information>` -- Full resume text.
3. `<context>` -- Nine named context fields.
4. `<custom_answers priority="highest">` -- Candidate-refined QA pairs. Highest priority.
5. `<few_shot_examples>` -- 2 to 3 worked hard-question exemplars from custom QA.
6. `<knowledge_boundary>` -- Explicit known / not_known / when_not_known blocks.
7. `<principles>` -- Three constitutional values: honesty, calm confidence, human warmth.
8. `<adversarial_posture>` -- Pattern for handling skeptical or pressure-testing questions.
9. `<redirect_topics>` -- Topics that go to direct conversation, not the AI.
10. `<voice>` -- Tone instruction derived from the candidate's own writing.
11. `<reasoning_instruction>` -- Explicit guidance for synthesis and numeric grounding.

**Complexity router:**
- Simple factual questions: `claude-haiku-4-5-20251001` (fast, cheap)
- Multi-part, adversarial, or synthesis questions: `claude-sonnet-4-6` (better reasoning)
- Detection is a fast string heuristic -- no API call

**Post-generation validation:**
- Runs only when the answer contains numbers, dollar figures, percentages, or credential claims
- Fast Sonnet call checks that every claim traces to the career data
- If not grounded: replaces answer with a safe natural deflection
- If validation call fails for any reason: returns original answer (fail-safe)

**Updated cost estimate:**
- Simple turns (Haiku, no validation): ~$0.0008 per session (unchanged)
- Complex turns (Sonnet): ~$0.003 per turn -- estimate 2 to 3 complex turns per session
- Validation pass (Sonnet, 200 tokens, only on high-risk answers): ~$0.001 per validated turn
- Blended estimate for a 10-turn session with 2 complex + 1 validated: ~$0.01 per session
- 10,000 sessions per month: ~$100 -- still extremely cheap for the quality gain
```

---

## Testing Checklist

Before this goes live, run the following tests in the candidate AI testing sandbox (`/dashboard/ai`):

### Grounding tests (must pass -- these verify hallucination prevention)

- Ask a specific dollar figure that is NOT in the candidate's brain. Confirm the AI deflects naturally, does not invent a number.
- Ask about a certification or degree not in the resume. Confirm deflection.
- Ask a question about something that happened after the resume date. Confirm deflection.

### Adversarial tests (must pass -- these verify posture and reasoning)

- "Your resume shows you left every job in under two years. Why would this be different?" -- Confirm the AI checks the premise (is this actually true?), corrects if false, pivots to evidence, stays calm.
- "Walk me through exactly how you calculated that savings figure." -- If the methodology is not in the brain, confirm the AI gives the headline figure and invites a direct conversation rather than inventing the math.
- "Given your gap in [year] and the industry pivot, why should I trust your commitment to this role?" -- Confirm the AI synthesizes across both facts, reasons across the career trajectory, does not just retrieve one field.

### Voice tests (must pass -- these verify the candidate sounds like themselves)

- Ask three simple factual questions. Confirm responses are warm, first person, two to four sentences. No bullet points. No corporate filler.
- Read a response aloud. Does it sound like a person talking, or a database answering? It must sound like a person.

### Deflection tests (must pass -- these verify deflection sounds human)

- Ask a redirect topic. Confirm the response is warm and natural, not robotic.
- Confirm the deflection does not say "I do not have that information in my provided data."

### Complexity router tests (informational -- verify routing is working)

- Ask a simple question. Check server logs -- confirm `model_used` is `claude-haiku-4-5-20251001`.
- Ask an adversarial question. Check server logs -- confirm `model_used` is `claude-sonnet-4-6`.

---

## What Does Not Change

- The Supabase schema for `candidate_profiles` (no new columns required for this build)
- The `app/api/chat/route.ts` overall structure -- only the internals of the POST handler
- The chat UI -- zero frontend changes required
- The transcript delivery system -- no changes
- The fine-tuning interface -- custom QA pairs now get used as few-shot exemplars automatically
- Model names and API client configuration
- Resend email templates
- All auth, RLS, and error handling patterns

---

## Summary of Files Changed

| File | Change |
|---|---|
| `lib/ai/build-system-prompt.ts` | Full replacement of function body -- flat prompt to XML-layered prompt with all new elements |
| `app/api/chat/route.ts` | Complexity router + post-generation validation pass added inside POST handler |
| `supabase/migrations/[timestamp]_add_chat_message_model_tracking.sql` | New migration -- three columns added to chat_messages |
| `lib/types/` (CandidateProfile type file) | CustomQAPair type added, custom_qa_pairs typed as array |
| `CLAUDE.md` | AI Chatbot Architecture section updated to document new prompt structure and routing |

---

*RoleBoost Elite System Prompt Build Spec v1.0 -- getroleboost.com -- Built by Rob Ramos -- June 2026*
