# RoleBoost -- AI Brain and Calling Card
## Product Vision and Scope Update
**Version:** 1.1
**Date:** June 2026
**Author:** Rob Ramos
**Purpose:** Update vision.md, PRD.md, and CLAUDE.md to reflect the evolved product flagship -- the candidate AI brain and mobile calling card -- and the growth loop that powers it.

---

## Instructions for Claude Code

This document defines a significant product evolution that must be reflected across three repository files. Read this entire document before making any changes. Then update each file in the order listed at the end of this document.

Do not rewrite the files from scratch. Use str_replace to update specific sections only. Preserve all existing content that is not explicitly replaced. Increment version numbers on all modified files.

No em dashes anywhere in any output. Use commas, semicolons, or periods instead.

---

## What Changed and Why

### The Old Framing

The previous product framing positioned RoleBoost as a career asset platform -- audio overviews, infographics, slide decks, ATS resumes -- supported by a personal AI chatbot. The asset suite was the flagship. The chatbot was a feature.

### The New Framing

The candidate AI brain is the flagship. The asset suite is value-added. Everything else -- the audio, the infographic, the resume, the intake interview, the calling card -- exists to feed the brain or deliver it to recruiters.

This reframe is not cosmetic. It changes what the product is, how it is described, how it is sold, and what gets built first.

### Why This Framing Is Correct

Research conducted June 2026 confirmed:

The candidate-owned AI chatbot category does not exist as a commercial product. Two individual developers (Joshua Curry with ChatJC, Vishal Patil with VAi) built DIY versions for themselves. No platform offers this to non-technical candidates. The category is empty.

Every existing candidate tool -- Jobscan, Teal, Rezi, Kickresume -- optimizes a document and walks away. They stop at the resume. None of them represent the candidate in a live conversation with a recruiter. None of them get smarter over time. None of them produce a transcript. None of them close the loop between what a recruiter asked and what the candidate needs to improve.

Employer-side AI (Paradox/Olivia acquired by Workday for $1 billion, Eightfold, HiredScore) is entirely focused on processing candidates faster for employers. None of it serves the candidate.

The market gap is not a gap in resume tools. It is a gap in candidate representation. RoleBoost fills it.

---

## The Flagship -- The Candidate AI Brain

### What It Is

A personal AI trained on each candidate's verified career data that represents them to recruiters 24/7, answers hard questions accurately, delivers a full transcript to both sides after every conversation, and gets smarter with every interaction.

### What Makes It Different From Every Other Tool

Every AI resume tool optimizes a document without knowing the person behind it. They produce plausible-sounding content -- including invented metrics -- because they have no access to the candidate's real story. A chatbot built on a resume scrape is a FAQ bot. It can answer "where did you work" but not "why did you leave" or "walk me through that gap."

RoleBoost's brain is built from three layers of verified context that no other tool collects:

**Layer 1 -- Document analysis.** The candidate uploads their resume, LinkedIn export, Indeed profile, or any combination. Claude Sonnet reads all uploaded documents simultaneously and does three things: extracts verified career facts, flags inconsistencies across documents (LinkedIn says VP, resume says Director; dates do not match; gap appears on one but not another), and identifies the 8 to 12 questions a recruiter would most likely ask based on what it found.

**Layer 2 -- AI intake interview.** The candidate is not handed a blank form. They are interviewed by an AI that already read their documents and knows what to ask. Questions are specific to that candidate's history, not generic. Candidate answers by typing or speaking. Voice input is transcribed and displayed for editing before submit. The intake runs 2 to 3 layers deep -- pass one asks the primary questions, pass two probes vague or incomplete answers, pass three fills remaining gaps. Maximum 20 questions across all passes. The candidate never sees pass boundaries -- they experience a conversation that gets progressively more specific.

**Layer 3 -- Recruiter conversation transcripts.** Every time a recruiter chats with the candidate's AI, the transcript is analyzed by Claude Sonnet after the session ends. Questions the chatbot deflected, follow-up questions that signaled incomplete first answers, and topics that came up without sufficient context are all identified and fed back to the candidate as expansion prompts. The brain grows from external interaction, not just internal reflection.

### The Growth Loop

```
Candidate builds brain via AI intake interview
        +
Recruiter conversations generate transcripts
        +
Transcript analysis identifies gaps and strong answers
        +
Prompt bot surfaces expansion questions from those gaps
        +
Candidate adds context via voice or text
        +
Brain gets deeper
        +
Chatbot performs better next conversation
        +
[loop repeats indefinitely]
```

This loop is the retention mechanism. The brain gets more valuable the longer the candidate stays on the platform. Switching cost is not the subscription fee -- it is the accumulated career intelligence that lives nowhere else.

### Hallucination Prevention

The brain is only as trustworthy as the context it is built from. Four layers prevent hallucination:

**Closed context system prompt.** The AI is explicitly told it can only answer from verified candidate context. If information is not in the context, it does not exist. It never guesses, estimates, or infers.

**Honest deflection.** When context is insufficient, the chatbot says so gracefully: "That specific detail is not something I have on hand -- [Candidate] would be better placed to answer that directly." This is a trust signal, not a failure state.

**Context completeness gate.** A brain readiness score shows the candidate where their context is thin before the link goes live. Critical areas (gaps, departure reasons, key wins) must be addressed before the profile is shareable.

**Candidate self-testing.** Every candidate tests their own chatbot in a sandbox before sharing the link. They ask the hard questions. They verify the answers are accurate. The link does not go in their LinkedIn profile until they have confirmed the brain is honest.

### Brain Compartmentalization

Each candidate's brain is completely isolated. One candidate's context cannot reach another candidate's chatbot. This is structural, not a rule:

Claude Haiku has no persistent memory between sessions. Each conversation starts fresh with only that candidate's system prompt loaded. The system prompt is built from exactly one candidate profile record. No aggregation, no cross-candidate context, no shared blocks. One profile in, one brain out.

The skill -- the AI's ability to read documents, spot inconsistencies, generate questions, build context, handle recruiter questions -- is the same process applied to every candidate. The output is completely unique to each one. Same skill. Isolated experience. Every time.

---

## The Calling Card -- Mobile-First Public Profile

### What It Is

A mobile-optimized public profile page at `getroleboost.com/c/[slug]` that functions as a digital calling card. No login required. No friction. The chat interface is the first thing a recruiter sees.

The candidate drops this link everywhere: LinkedIn contact info, LinkedIn About section, resume header, email signature, Indeed profile bio, job application follow-up emails. One link. Every context.

### The Mobile Experience -- Three Layers

**Layer 1 -- The Card (above the fold on mobile)**
Everything a recruiter needs in under five seconds:
- Candidate name and avatar
- Headline (one line)
- Target role
- Chat input, open and ready, with placeholder text: "Ask [Name] anything about their career"
- One tap to start the conversation

Nothing else. No navigation. No tabs. No scrolling required to reach the chat.

**Layer 2 -- The Profile (scroll or tap "Learn more")**
- Audio overview with a prominent play button
- Key stats infographic -- three or four numbers that define the career
- Two to three sentence bio

**Layer 3 -- The Full Package (for recruiters going deep)**
- Full resume download
- Slide deck
- All remaining assets

Most recruiters never leave Layer 1. They chat, get a transcript, and move on. Layers 2 and 3 exist for recruiters who want more before a call.

### Chat Opens as Full-Screen Overlay on Mobile

Tapping the chat input expands to a full-screen chat interface. The card is the introduction. The overlay is the conversation. Closing the overlay returns the recruiter to the card. Clean separation.

### After the Conversation

When the recruiter closes the chat or after 30 minutes of inactivity, a transcript is generated and delivered by email to both sides immediately.

**The recruiter receives:** Full transcript, direct link to save the candidate, send feedback, or schedule a call.

**The candidate receives:** Full transcript, pattern insights from recent recruiter conversations, specific expansion prompts to strengthen the brain based on what was asked.

### PWA Support

The profile page is PWA-capable (Progressive Web App). Recruiters evaluating a candidate can add the profile to their phone home screen for one-tap access throughout the hiring process. No app store. No download. Just there.

### Native Share on Mobile

A visible share button triggers the native iOS or Android share sheet. One tap to send the profile link via text, email, Slack, Teams, or any other app. The link propagates through the hiring process -- recruiter shares with hiring manager, hiring manager shares with panel -- without the candidate doing anything.

---

## The Prompt Bot -- Brain Expansion Over Time

### What It Does

A lightweight AI coach that lives in the candidate dashboard and surfaces specific expansion questions when the brain has room to grow. Not generic. Not scheduled. Contextual and specific, based entirely on what is already in the brain.

### Trigger Events

**Gap identified from recruiter conversation.** "A recruiter recently asked about your budget responsibility at [Company]. Your AI did not have enough detail to answer confidently. Can you add that now?"

**Pattern detected across multiple conversations.** "This question has come up in 4 of your last 6 recruiter conversations. Your AI's current answer may not be landing. Want to strengthen it?"

**Thin area detected in existing context.** "Your AI knows what you achieved at [Company] but not how you approached the first 90 days. Recruiters at the director level ask about this. Here is a prompt to expand on it."

**Resume or profile update.** "You added a new role. Your AI needs context on why you made that move and what you accomplished. Here are two questions to get started."

**Time-based nudge (30 days inactive).** "You have been active for a month. Here are two areas where a little more detail would make your AI significantly stronger."

### What the Prompts Look Like

Always two to three specific questions. Never a blank box. Always grounded in what is already in the brain.

Good example: "You mentioned the third shift build at Brightship but did not describe how you handled the first 30 days once the team was hired. What did that onboarding period look like and what would you do differently?"

Bad example: "Tell us more about your leadership style." (Generic, not grounded in context -- never do this.)

### Brain Health Score

A visible readiness indicator in the candidate dashboard. Not gamification -- a genuine signal of how well-armed the chatbot is.

```
Your AI is ready for:
Core career questions          [====    ] 80%
Hard questions (gaps, pivots)  [===     ] 50%
Leadership and philosophy      [=====   ] 70%
Role-specific depth            [=       ] 20%

2 prompts ready to strengthen your weakest areas
```

Score is calculated from context completeness per category, not from a points system. Each category maps to the fields that feed it.

### Notification Delivery

**In-app:** Quiet indicator on the dashboard. "Your AI has 2 new expansion prompts ready." Not a red badge.

**Email:** Weekly digest only. "Here is what your AI learned from recruiter conversations this week, and here are two ways to make it stronger." One email. Skippable.

**Push (mobile):** High-priority gaps only. "A recruiter asked your AI something it could not answer. Tap to fill that gap now." Tied to real missed opportunities.

---

## The Fiverr Service -- Reframed

### Old Framing

"Career asset package." The thing being sold was the audio overview, the infographic, the slide deck, the resume.

### New Framing

"We build your AI brain for you." The thing being sold is a live chatbot that represents the candidate accurately to any recruiter who clicks their link. The assets come with it. But they are not the product.

### What the Elite Package Actually Delivers

Rob conducts the intake interview -- reads the candidate's documents, runs the AI analysis, asks the personalized questions, captures the answers. The output is a fully built, tested, live AI brain plus the complete asset suite. The candidate leaves with a shareable link they can put in their LinkedIn profile that day.

This is the done-for-you version of what the self-serve platform automates. Same output. Different delivery. The Elite price point is now justified by something that actually cannot be replicated by a cheaper tool -- a verified, tested, recruiter-ready AI brain.

---

## The Asset Suite -- Value-Added Role

The audio overview, debate audio, video, infographic, and slide deck remain part of the product. Their role shifts:

**ATS resume:** What gets the candidate past the filter so a recruiter finds the link in the first place.

**Audio overview:** What a recruiter listens to before or after chatting with the AI. Provides the narrative arc.

**Infographic:** What makes the profile page worth sharing on LinkedIn. Visual proof of the career story.

**Resume Intelligence:** What arms the AI before the first recruiter question arrives. Identifies the hard questions coming and closes the gaps before a recruiter exposes them.

None of these are the flagship. They are all reasons the flagship works better.

---

## Updated Competitive Positioning

| Platform | What They Do | The Gap They Leave |
|---|---|---|
| Jobscan / Teal / Rezi | Optimize a document for ATS | Stop at the document. Candidate is on their own after. |
| LinkedIn | Passive text profile | No AI. No conversation. No transcript. |
| Resume writers | Human-written text | One-time output. Does not represent the candidate live. |
| ATS graders | Resume score and keywords | Coach the document, not the person. |
| Paradox / Olivia | Employer-owned AI screening | Works for the employer. Eliminates candidates. |
| Eightfold / HiredScore | Employer AI ranking | Scores candidates against employer criteria. No candidate control. |
| DIY chatbots (Curry, Patil) | Individual developers building their own | Requires technical ability. Not available to non-technical candidates. |

**RoleBoost is the only platform that gives non-technical candidates a personal AI that represents them accurately in live recruiter conversations, gets smarter from every interaction, and delivers a transcript to both sides.**

---

## Updated Moats

**Moat 1 -- The brain depth.** Context built from documents plus layered AI intake plus recruiter conversation transcripts. Nobody else collects all three. The brain after six months of recruiter conversations is something that cannot be replicated by a document tool.

**Moat 2 -- The growth loop.** The brain compounds with every recruiter interaction. Time on platform equals brain depth. A candidate who has been on RoleBoost for six months has a fundamentally more capable AI than one who joined yesterday. That gap widens over time.

**Moat 3 -- The transcript layer.** Every conversation generates data. That data feeds the brain. The brain feeds better conversations. Better conversations generate better data. This loop is impossible to replicate without the conversation history it depends on.

**Moat 4 -- The honest read.** Every other AI tool inflates. RoleBoost grounds. In a market where 91% of hiring managers have caught AI misrepresentation, the honest candidate is the differentiated one. That positioning is defensible as long as the platform enforces it.

---

## Files to Update in the Repository

Update the following files using str_replace. Do not rewrite from scratch. Preserve all content not explicitly replaced.

---

### File 1: `vision.md`

**Current version:** 3.2
**New version:** 4.0

**Replace the "The Solution" section** (currently at line 78) with the following:

```
## The Solution

The world's first candidate-owned AI representation platform.

The candidate AI brain is the flagship. Everything else -- the audio overview, the infographic, the ATS resume, the asset suite -- exists to feed the brain or deliver it to recruiters.

Job seekers upload their resume and any other career context they have. The platform reads all of it, flags inconsistencies across documents, and conducts a personalized AI intake interview -- not a generic form, but a conversation driven by what the AI actually found in their specific documents. Candidates answer by typing or speaking. Two to three layers of follow-up questions produce a brain deep enough to handle the questions recruiters actually ask.

That brain powers a personal career AI accessible via one shareable link. The link goes in their LinkedIn profile, their resume header, their email signature. A recruiter clicks it on their phone, sees a clean calling card, asks questions directly, and has a full transcript in their inbox before they finish their coffee.

No back and forth. No scheduling. No defensive screening calls. No three-day email chains. The recruiter gets the information they need. The candidate gets a transcript of exactly what was asked and what the AI said. Both sides move faster.

The brain grows with every interaction. Recruiter conversations generate transcripts that are analyzed for gaps. A prompt bot surfaces specific expansion questions based on what was asked. The candidate adds context. The brain gets smarter. The next recruiter gets a better answer.

One shareable link. A brain that grows. Your AI available around the clock.
```

**Replace the "How It Works -- The Candidate Experience" section** with the following:

```
## How It Works

### The Candidate Experience

1. **Upload** -- Resume, LinkedIn export, Indeed profile, or any combination. The more context provided, the deeper the brain.
2. **Cross-document analysis** -- Platform reads all uploaded documents simultaneously. Flags inconsistencies across documents. Identifies what recruiters will ask based on what it found.
3. **AI intake interview** -- The candidate is interviewed by an AI that already read their documents. Questions are specific to their history. 8 to 12 questions per pass, 2 to 3 passes deep, maximum 20 questions total. Candidate answers by typing or speaking (voice transcribed and editable before submit).
4. **Brain assembled** -- All verified context becomes the system prompt powering the personal career AI. The chatbot can only answer from verified context -- it never invents, guesses, or inflates.
5. **Candidate tests the brain** -- In a sandbox, the candidate asks their own AI the hard questions. Verifies accuracy. The link does not go live until the candidate confirms the brain is honest.
6. **One link goes live** -- `getroleboost.com/c/[slug]` -- shareable anywhere. Mobile-optimized calling card with chat front and center. No login required for recruiters.
7. **Recruiters interact** -- Ask questions directly from the calling card on any device. Full transcript delivered to both sides after every session.
8. **Brain grows** -- Transcript analysis identifies gaps. Prompt bot surfaces expansion questions. Candidate adds context. Loop repeats.
```

**Replace the "Three Defensible Moats" section** with the following:

```
## Four Defensible Moats

1. **The brain depth** -- Context from documents plus layered AI intake plus recruiter conversation transcripts. Nobody else collects all three. The brain after six months of recruiter interactions cannot be replicated by a document tool.
2. **The growth loop** -- The brain compounds with every recruiter interaction. Time on platform equals brain depth. That gap widens over time and raises the switching cost without locking anyone in.
3. **The transcript layer** -- Every conversation generates data that feeds the next. Impossible to replicate without the conversation history it depends on.
4. **The honest read** -- Every other AI tool inflates. RoleBoost grounds. In a market where 91% of hiring managers have caught AI misrepresentation, the honest candidate is the differentiated one.
```

**Replace the Fiverr/Done-For-You table** with the following:

```
### Done-For-You Service (Fiverr / Direct)

The done-for-you service sells a live AI brain, not a document package.

| Package | Price | What's Included |
|---|---|---|
| Starter | $49 | ATS resume + profile setup + shareable link |
| Standard | $99 | ATS resume + audio overview + infographic + profile setup |
| Pro | $197 | Full asset suite + profile setup + basic chatbot context |
| Elite | $397 | Full asset suite + founder-conducted AI intake interview + fully built and tested brain + fine-tuning session + live chatbot ready to share |
```

**Add the following new section** after the Competitive Positioning table:

```
## The Calling Card

The public profile at `getroleboost.com/c/[slug]` is designed as a mobile-first digital calling card. When a recruiter clicks the link from any context -- LinkedIn, a resume header, an email signature, an Indeed profile -- they land on a page that communicates three things in under five seconds: who this person is, what this page does, and an immediate invitation to start a conversation.

The chat input is open and ready above the fold on every device. No tabs to find. No buttons to click first. One thumb.

The calling card has three layers. Layer 1 is the card itself -- name, headline, target role, chat input. Layer 2 is the profile -- audio overview, key stats, brief bio. Layer 3 is the full package -- resume download, slide deck, all assets. Most recruiters never leave Layer 1.

The page is PWA-capable, meaning recruiters can add it to their phone home screen for one-tap access throughout the hiring process. A native share button lets recruiters send the link to hiring managers or panel members with one tap.

When the recruiter closes the chat, a transcript is generated and emailed to both sides immediately. The recruiter gets a record of the conversation with a direct link to save the candidate. The candidate gets a record of what was asked and specific prompts to strengthen the brain based on what the recruiter explored.
```

---

### File 2: `PRD.md`

**Current version:** 3.0
**New version:** 3.1

**Add the following as a new Section 8B** immediately after Section 8A (Resume Intelligence):

```
## Section 8B -- AI Intake Interview

### 8B.1 Overview

The AI intake interview replaces the generic context form. Instead of blank fields, the candidate is interviewed by an AI that has already read all their uploaded documents. Questions are generated specifically from what the AI found -- inconsistencies, gaps, thin areas, impressive claims that need backup. Candidates answer by typing or speaking.

This is the primary mechanism for building the candidate's AI brain. The quality of the intake determines the quality of the chatbot.

### 8B.2 Document Ingestion

Accepted upload types for brain building:
- Resume (PDF or DOCX) -- required minimum
- LinkedIn profile export (PDF or text)
- Indeed profile (text paste or PDF)
- Other job board profiles (text paste)

All uploaded documents are read simultaneously by Claude Sonnet. The analysis identifies:
- Verified career facts (roles, dates, companies, metrics, credentials)
- Inconsistencies across documents (title discrepancies, date mismatches, gaps that appear on one document but not another, metric differences)
- The 8 to 12 questions a recruiter would most likely ask based on what was found

### 8B.3 Inconsistency Report

Before the intake interview begins, the candidate sees a clear list of inconsistencies found across their uploaded documents. Each item is plainly stated:

"Your resume lists your title at [Company] as Director of Operations. Your LinkedIn profile lists it as VP of Operations. Recruiters and background check services will catch this. Which is accurate?"

This report alone is a differentiated feature. No other tool does cross-document consistency checking for candidates. It surfaces discrepancies the candidate may not know exist and gives them a chance to resolve them before a recruiter or background check service finds them.

### 8B.4 Intake Interview Flow

The interview runs in a conversational UI, one question at a time. The candidate does not see pass boundaries. They experience a single conversation that gets progressively more specific.

**Pass 1 (8 to 12 questions):** Primary questions based on document analysis. Covers employment gaps, career pivots, departure reasons, key wins requiring backup, degree gaps, short tenures, and anything else the document analysis flagged.

**Pass 2 (4 to 6 questions):** Follow-up questions targeting vague or incomplete Pass 1 answers. Only triggered for answers that were insufficient -- not for answers that were complete and specific. A short Claude Haiku evaluation pass scores each Pass 1 answer before Pass 2 questions are generated.

**Pass 3 (2 to 4 questions):** Final depth probes for areas still thin after Pass 2. Only triggered if genuine gaps remain. Often does not trigger at all if the candidate was thorough in Passes 1 and 2.

**Maximum total questions across all passes:** 20.

### 8B.5 Voice Input

Candidates can answer any question by speaking instead of typing.

- Browser-based audio recording via Web Audio API
- Transcription via OpenAI Whisper API
- Transcript displayed immediately for candidate review and editing
- Candidate submits the edited transcript, not the raw audio
- Raw audio is not stored after transcription

Cost estimate: approximately $0.003 per 90-second voice answer. Negligible at any realistic scale.

### 8B.6 Pass Evaluation Logic

Before generating Pass 2 questions, Claude Haiku evaluates each Pass 1 answer against four criteria:

1. Does it contain specific details or is it vague?
2. Does it use real numbers or generalizations?
3. Does it answer what was actually asked?
4. Does it raise new questions that need following up?

Answers scoring well on all four criteria do not generate Pass 2 follow-ups. Only insufficient answers trigger deeper probing. This keeps Pass 2 lean and targeted.

### 8B.7 Brain Assembly

After all passes are complete, the system assembles the candidate's brain -- a structured context document organized by topic that feeds the system prompt for the AI chatbot. The brain is stored in the candidate's profile and is editable at any time through the fine-tuning interface.

Brain structure per topic:
- What the documents showed
- What the candidate said in Pass 1
- What was clarified in Pass 2
- What was confirmed in Pass 3

This layered structure is visible to the candidate in the dashboard as their "brain depth" view.

### 8B.8 Context Completeness Gate

A brain readiness score is calculated from context completeness across four categories:

- Core career questions (roles, dates, basic history)
- Hard questions (gaps, pivots, departures, degree gaps)
- Leadership and philosophy
- Role-specific depth

The candidate sees this score and the specific areas that are thin before sharing their link. The chatbot can be shared at any completeness level -- but the candidate is clearly informed of what their AI can and cannot handle confidently.

### 8B.9 API Endpoint

`POST /api/intake/analyze`

**Request:**
```typescript
{
  candidateProfileId: string,
  uploadedDocumentIds: string[],
  pass: 1 | 2 | 3,
  previousAnswers?: IntakeAnswer[]
}
```

**Response:**
```typescript
{
  inconsistencies: Inconsistency[],
  questions: IntakeQuestion[],
  passComplete: boolean,
  nextPassRecommended: boolean
}

type Inconsistency = {
  id: string,
  sourceA: string,       // which document
  sourceB: string,       // which document
  description: string,   // plain language explanation
  severity: 'high' | 'medium' | 'low'
}

type IntakeQuestion = {
  id: string,
  question: string,
  context: string,       // why this question is being asked
  category: string,      // maps to brain section
  pass: number,
  followUpOf?: string    // ID of Pass 1 question this probes
}
```

### 8B.10 Data Model Additions

```sql
ALTER TABLE candidate_profiles
  ADD COLUMN IF NOT EXISTS intake_completed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS intake_pass1_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS intake_pass2_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS intake_pass3_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS brain_readiness_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inconsistencies_found JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS inconsistencies_resolved JSONB DEFAULT '[]';

CREATE TABLE intake_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  question_text TEXT NOT NULL,
  answer_text TEXT NOT NULL,
  answer_source TEXT NOT NULL CHECK (answer_source IN ('typed', 'voice')),
  pass_number INTEGER NOT NULL CHECK (pass_number IN (1, 2, 3)),
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE intake_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY intake_answers_owner ON intake_answers
  FOR ALL TO authenticated
  USING (
    candidate_profile_id IN (
      SELECT id FROM candidate_profiles WHERE clerk_user_id = requesting_user_id()
    )
  );
```

### 8B.11 Phase and Priority

**Phase 3** -- builds after the base chat endpoint is live and producing transcripts.

Build sequence within Phase 3:
1. Document upload and cross-document analysis (Sonnet)
2. Inconsistency report UI
3. Pass 1 question generation and conversational UI
4. Voice input and Whisper transcription
5. Pass evaluation logic and Pass 2 generation
6. Pass 3 conditional trigger
7. Brain assembly and readiness score
8. Integration with system prompt builder
```

**Add the following as a new Section 8C** immediately after Section 8B:

```
## Section 8C -- Transcript-to-Brain Loop

### 8C.1 Overview

Every recruiter chat session generates a transcript. That transcript is analyzed by Claude Sonnet after the session ends to identify gaps, insufficient answers, and new topics that need more context. The analysis feeds the prompt bot, which surfaces targeted expansion questions to the candidate.

This closes the growth loop. The brain grows not just from what the candidate provides but from what recruiters actually ask.

### 8C.2 Post-Session Analysis

Triggered after every chat session ends (modal close or 30-minute inactivity timeout), immediately after the transcript emails are sent.

Claude Sonnet receives the full transcript and the current brain context and returns a structured analysis:

```typescript
{
  deflections: TranscriptGap[],      // questions the chatbot could not answer
  weakAnswers: TranscriptGap[],      // answers that prompted follow-up questions
  newTopics: TranscriptGap[],        // topics raised without brain coverage
  strongAnswers: string[]            // question IDs the chatbot handled well
}

type TranscriptGap = {
  questionAsked: string,
  chatbotAnswer: string,
  gapType: 'deflection' | 'weak' | 'new_topic',
  suggestedPrompt: string,           // ready-to-display expansion prompt
  category: string,                  // which brain section this feeds
  priority: 'high' | 'medium' | 'low'
}
```

### 8C.3 Prompt Bot

Gaps from transcript analysis are added to the candidate's prompt queue. The prompt bot surfaces them in priority order through three channels:

**In-app:** Quiet indicator on the dashboard. Not intrusive.

**Email:** Weekly digest. One email. Lists what recruiters asked this week and two to three specific expansion prompts.

**Push (mobile):** High-priority gaps only. Tied to real missed recruiter opportunities.

Prompts are always specific and grounded in existing brain content. Generic prompts are never generated.

### 8C.4 Pattern Detection

When the same topic appears as a gap across three or more sessions, it is flagged as a pattern. Pattern gaps are surfaced with higher priority and include the frequency count:

"This question has come up in 4 of your last 6 recruiter conversations. Your AI's current answer may not be landing. Want to strengthen it?"

### 8C.5 Brain Health Score Update

After each transcript analysis, the brain health score is recalculated. Gaps reduce the score in their category. Expansion prompts answered increase it. The score reflects the current state of the brain, not a historical high.

### 8C.6 Data Model Additions

```sql
CREATE TABLE transcript_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  chat_session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  question_asked TEXT NOT NULL,
  chatbot_answer TEXT NOT NULL,
  gap_type TEXT NOT NULL CHECK (gap_type IN ('deflection', 'weak', 'new_topic')),
  suggested_prompt TEXT NOT NULL,
  category TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  is_addressed BOOLEAN NOT NULL DEFAULT FALSE,
  pattern_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE transcript_gaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY transcript_gaps_owner ON transcript_gaps
  FOR ALL TO authenticated
  USING (
    candidate_profile_id IN (
      SELECT id FROM candidate_profiles WHERE clerk_user_id = requesting_user_id()
    )
  );
```

### 8C.7 Phase and Priority

**Phase 3** -- builds after transcript delivery is live and producing data.

Build sequence within Phase 3:
1. Post-session Sonnet analysis call
2. Gap storage in transcript_gaps table
3. Prompt bot in-app indicator
4. Prompt bot email digest via Resend
5. Pattern detection (3+ session threshold)
6. Brain health score recalculation
7. Push notification for high-priority gaps (Phase 4)
```

---

### File 3: `CLAUDE.md`

**Current version:** current (no explicit version -- add version comment at top)

**Add the following entry to the "What Not to Build in MVP" section:**

```
- Multi-candidate context blending -- each brain is isolated to one candidate profile, never aggregated across candidates
- Auto-publish brain without candidate self-test -- candidate must verify accuracy before link goes live
```

**Add the following new section** at the end of the Claude API Usage section:

```
### Brain Compartmentalization Rule

Each chat session loads exactly one candidate's system prompt. The system prompt is built from exactly one candidate_profile record. No cross-candidate context. No aggregation. No shared blocks. This is enforced in code, not just by convention.

The candidate's brain is their verified career data only. The chatbot answers from that context or deflects honestly. It never guesses, estimates, or fills gaps with plausible-sounding content.

Hallucination prevention is enforced through four mechanisms:
1. Closed context system prompt -- AI told explicitly it can only answer from provided context
2. Honest deflection response -- graceful handling of gaps without invented answers
3. Context completeness gate -- thin brains flagged before link goes live
4. Candidate self-testing -- accuracy verified by candidate before sharing

### Voice Transcription

OpenAI Whisper API handles voice-to-text for intake interview answers.

- Browser records audio via Web Audio API
- Audio sent to `/api/transcribe` (server-side Whisper call)
- Transcript returned to UI for candidate review and editing
- Candidate submits edited transcript
- Raw audio is not stored after transcription
- Estimated cost: $0.003 per 90-second answer

Add to environment variables:
```bash
OPENAI_API_KEY=   # Whisper transcription only -- not used for chat or generation
```
```

---

## New Concepts Added in v1.1

Three new product concepts developed June 2026 are documented below. Each requires PRD additions. Instructions for Claude Code are at the end of this section.

---

## The Founder as First Guinea Pig

### Why This Matters

Rob Ramos is the first RoleBoost candidate. His profile is the live proof of concept, the platform demo, and the first documented recruiter interaction -- all in one.

The founder brings 20+ years of operations and logistics experience from floor to VP. That is the exact beachhead market. When a logistics recruiter or warehouse VP clicks Rob's RoleBoost link, they are not reading marketing copy -- they are experiencing the product firsthand from someone they recognize as credible in their domain.

### What This Unlocks Immediately

Rob's profile can go live before any other candidate is on the platform. The link goes in his LinkedIn bio, email signature, Fiverr profile, and resume header today. Every recruiter or hiring manager who clicks it and interacts with the AI is a real documented recruiter conversation -- the proof point the platform needs before any employer subscription conversation is possible.

This is also the fastest path to catching product friction. Every confusing question in the intake interview, every weak chatbot answer, every awkward deflection -- Rob experiences it personally before a paying candidate does. The founder's own profile is the quality gate.

### How to Build It

Rob goes through the intake interview as a candidate. No shortcuts. Full document upload (resume, LinkedIn export). Full cross-document analysis. Full 2 to 3 pass AI intake interview using voice input. Complete sandbox testing against the 20 hardest recruiter questions from 20 years of operations hiring experience. Brain does not go live until every hard question produces an answer Rob would be satisfied receiving from a strong candidate.

The target outcome: a live chatbot at `getroleboost.com/c/rob-ramos` that any operations or logistics recruiter can interrogate and receive a full transcript from. That profile is the platform's first and most important asset.

---

## The Sandbox and AI-Powered Fine-Tuning Dashboard

### What It Is

A private testing environment inside the candidate dashboard where candidates stress-test their own AI before sharing the link -- and receive specific AI-powered coaching on exactly what to fix and where.

The sandbox is not a "test your chatbot" feature. It is the confidence mechanism that drives distribution. A candidate who has verified their AI handles the hardest recruiter questions accurately is a candidate who shares their link everywhere. Active sharing from confident candidates is how the platform gets recruiter interactions without spending on recruiter acquisition.

### The Sandbox Interface

A chat interface inside the candidate dashboard at `/dashboard/ai` that looks identical to what a recruiter sees on the public profile, with one difference: a clear label indicating this is a private test. No transcript sent. No session logged as a recruiter interaction. No employer notification.

The sandbox opens with a **suggested question library** -- not a blank input. A curated set of the 20 hardest recruiter questions organized by category, drawn from real recruiter behavior in operations and logistics hiring:

**Gap and departure questions:**
- "Walk me through the gap between [Company A] and [Company B]."
- "Why did you leave [most recent role]?"
- "What actually happened at [Company]?"
- "I see you have left three jobs in four years. Why should this be different?"

**Commitment and tenure questions:**
- "Your average tenure is under two years. What guarantees you will stay?"
- "You are overqualified for this role. Why do you want it?"
- "Where do you see yourself in five years?"

**Metric and achievement verification questions:**
- "Walk me through exactly how you calculated that cost savings figure."
- "How did you measure the 40% improvement you mentioned?"
- "That team size seems unusually large for that role. Can you clarify?"

**Leadership and management questions:**
- "Describe how you handle an underperforming team member. Give me a real example."
- "Tell me about a time you disagreed with your manager. What did you do?"
- "What would your last direct report say is your biggest weakness as a leader?"

**Adversarial premise questions:**
- "Given your background, why should I trust your commitment to an operations role?"
- "Your resume shows a lot of accomplishments but no degree. How do you respond to that?"
- "Candidates with your profile typically struggle with [X]. How are you different?"

**Weakness and failure questions:**
- "What are you genuinely not good at? Be honest."
- "Tell me about your biggest professional failure."
- "What would your references say about your weaknesses?"

The candidate selects a question from the library or types their own. The AI answers. Then the analysis runs.

### The AI Analysis Layer

After each sandbox answer, Claude Sonnet runs a fast evaluation against a specific rubric and returns a plain-language diagnosis:

**Evaluation criteria:**
- Did the answer use specific documented facts or vague generalizations?
- Did it stay grounded in the brain or drift toward invented detail?
- Was the response length appropriate -- too short, too long, or right?
- Did it sound like the candidate or like a generic AI?
- If the question was adversarial, did it handle the false premise correctly or capitulate?
- If the question involved a number or credential, was that claim grounded in the brain?

**Output format -- a diagnosis and a prescription:**

Not a score. A specific, actionable finding linked directly to the brain field that needs work.

Good example: "Your AI gave a vague answer to the departure question about [Company] because your departure reasons field only covers two roles and does not include this one. A recruiter asking this in the first 60 seconds of a screening call needs a specific, calm answer. Click here to add that context now."

Bad example: "Your answer could be improved." (Never do this -- not actionable.)

Each diagnosis includes:
- What the AI said (quoted)
- What was weak about it (specific, not generic)
- What brain field or custom QA pair needs more content
- A direct link to that field with the cursor placed in it
- A suggested expansion prompt to get started

### Pattern Recognition Across Sandbox Sessions

The analysis runs not just on individual questions but across all sandbox sessions to identify categories where the brain is consistently weak. If departure questions produce weak answers three times across different sandbox sessions, the brain health score drops in that category and the prompt bot surfaces it as a priority.

This pattern layer connects the sandbox directly to the transcript-to-brain loop -- both produce gap signals, both feed the same prompt bot queue, both update the same brain health score.

### PRD Addition -- Section 8D

**Add the following as Section 8D immediately after Section 8C in PRD.md:**

```
## Section 8D -- Sandbox and AI-Powered Fine-Tuning

### 8D.1 Overview

The sandbox is a private testing environment inside the candidate dashboard where candidates stress-test their AI against the hardest recruiter questions and receive specific AI-powered coaching on what to fix. It is the confidence mechanism that drives profile sharing.

### 8D.2 Sandbox Interface

**Location:** `/dashboard/ai` -- below the brain health score, above the transcript history.

**Components:**
- Chat interface identical to public modal chat (same endpoint, `sandbox: true` flag)
- Suggested question library -- 20 questions organized by 5 categories
- Free-form input for custom questions
- Analysis panel that appears after each AI response
- "Run full diagnostic" button that runs all 20 suggested questions in sequence and returns a complete brain health report

**Sandbox flag behavior:**
- `sandbox: true` on API call suppresses transcript delivery
- Session not logged to `chat_sessions` as a recruiter interaction
- No employer notification triggered
- Conversation history cleared on page reload

### 8D.3 Suggested Question Library

Stored as a static JSON file at `lib/ai/sandbox-questions.json`. Organized by category:

```typescript
type SandboxQuestion = {
  id: string,
  category: 'gap_departure' | 'commitment_tenure' | 'metric_verification' 
            | 'leadership' | 'adversarial' | 'weakness_failure',
  question: string,
  whyItMatters: string,    // shown to candidate before they run it
  brainFieldsTestedId: string[]  // which brain fields this question probes
}
```

### 8D.4 Post-Answer AI Analysis

After each sandbox answer, a Claude Sonnet evaluation call runs:

**API endpoint:** `POST /api/sandbox/analyze`

**Request:**
```typescript
{
  candidateProfileId: string,
  question: string,
  answer: string,
  questionCategory: string,
  brainSnapshot: string    // current system prompt -- what the AI had available
}
```

**Response:**
```typescript
{
  verdict: 'strong' | 'adequate' | 'weak' | 'hallucinated',
  diagnosis: string,          // plain language -- what was weak and why
  prescription: string,       // exactly what to add and where
  brainFieldTarget: string,   // which field to link to
  expansionPrompt: string,    // suggested text to get the candidate started
  patternSignal: boolean      // true if this is a recurring weakness category
}
```

**Verdict definitions:**
- `strong` -- answer was grounded, specific, and appropriately handled the question
- `adequate` -- answer was acceptable but could be stronger with more context
- `weak` -- answer was vague, deflected unnecessarily, or missed the point
- `hallucinated` -- answer contained a claim not present in the brain (triggers immediate alert)

### 8D.5 Full Diagnostic Mode

"Run full diagnostic" executes all 20 suggested questions in sequence against the candidate's AI and returns a complete brain health report organized by category. Each category gets a verdict (strong / adequate / weak) with the specific questions that produced each verdict.

The report is the most complete view of brain readiness available. It runs before the candidate shares their link for the first time and can be re-run after any significant brain update.

Estimated cost: 20 Haiku calls + 20 Sonnet analysis calls. Approximately $0.05 per full diagnostic run.

### 8D.6 Data Model Additions

```sql
CREATE TABLE sandbox_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  question_category TEXT NOT NULL,
  ai_answer TEXT NOT NULL,
  verdict TEXT NOT NULL CHECK (verdict IN ('strong', 'adequate', 'weak', 'hallucinated')),
  diagnosis TEXT NOT NULL,
  prescription TEXT NOT NULL,
  brain_field_target TEXT,
  expansion_prompt TEXT,
  pattern_signal BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sandbox_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sandbox_sessions_owner ON sandbox_sessions
  FOR ALL TO authenticated
  USING (
    candidate_profile_id IN (
      SELECT id FROM candidate_profiles WHERE clerk_user_id = requesting_user_id()
    )
  );
```

### 8D.7 Phase and Priority

**Phase 3** -- builds alongside the chat endpoint and testing interface already specced in Section 3.3.

Build sequence within Phase 3:
1. Basic sandbox chat interface with `sandbox: true` flag
2. Suggested question library JSON and UI
3. Post-answer Sonnet analysis call and diagnosis display
4. Direct link from diagnosis to brain field
5. Full diagnostic mode
6. Pattern signal connection to prompt bot queue
7. Hallucinated verdict alert and immediate brain field CTA
```

---

## External Transcript Hardening

### What It Is

Candidates can upload or paste conversation transcripts from any source -- real recruiter calls they summarized, practice sessions with other AI tools, LinkedIn message threads, interview debrief notes, informational interview notes -- and the platform analyzes them to identify brain gaps and generate targeted expansion prompts.

This is the most powerful brain growth mechanism because it feeds verified external intelligence -- real questions from real hiring professionals -- directly into the improvement loop.

### Why It Is More Powerful Than Internal Sandbox Testing

The sandbox tests the brain against predicted questions. External transcript hardening tests it against questions that actually happened. A candidate who brings transcripts from 15 screening calls they had before discovering RoleBoost arrives with a fully mapped set of their real weaknesses. The brain hardens specifically against what real recruiters in their target market actually ask -- not what a question library predicts they will ask.

### Scenarios Where This Is Enormously Valuable

**Pre-platform job search history.** A candidate who has been searching for three months before finding RoleBoost has had 10 to 20 screening calls. They know which questions hurt them. They bring those transcripts. The brain immediately hardens against the specific gaps that real recruiters already found.

**Other AI practice tools.** Candidates using ChatGPT or Claude directly to practice interview answers paste those transcripts in. All prior practice becomes brain fuel rather than wasted effort.

**LinkedIn message threads.** A recruiter asked three qualifying questions in a DM before deciding whether to schedule. The candidate pastes the thread. The brain learns what that type of recruiter cares about.

**Interview debrief notes.** The candidate did not get the offer. They have notes from the debrief. The brain learns exactly what the hiring committee found insufficient and hardens specifically against those objections.

**Informational interview notes.** A coffee chat revealed gaps the candidate had not considered. Paste it in. Brain gets smarter.

### The Analysis Process

Claude Sonnet reads the uploaded transcript and does four things simultaneously:

**Step 1 -- Map questions to brain sections.** Every question asked in the transcript is identified and mapped to the brain section that should answer it. Not just hard questions -- all questions, including simple ones that might reveal thin coverage areas.

**Step 2 -- Gap analysis against current brain.** For each mapped question, evaluate whether the current brain has sufficient context to answer it well. Not how the candidate answered in that conversation -- how the AI would answer right now with the current brain. This reveals gaps the candidate may not have noticed.

**Step 3 -- Flag weak coverage areas.** Questions where the current brain would produce a weak or deflecting answer -- when a strong answer was available -- are flagged as high-priority gaps.

**Step 4 -- Generate expansion prompts.** For each identified gap, generate a specific expansion prompt that references the question that revealed it: "A recruiter asked about your budget authority at Brightship and your brain does not have enough detail to answer confidently. Walk through the scope of your financial responsibility in that role."

### Privacy Design

External transcripts contain the recruiter's questions and potentially their name, company, and communication style. The candidate owns their side of the conversation. The recruiter's side is reference material only.

Design rules:
- Uploaded transcripts are processed and discarded -- not stored as recruiter data
- Never used to identify or profile the recruiter
- Never surfaced in any employer-facing part of the platform
- Output is brain improvement recommendations only
- Disclosed clearly in the UI: "Transcripts you upload are used only to improve your AI brain. They are analyzed and discarded."

### PRD Addition -- Section 8E

**Add the following as Section 8E immediately after Section 8D in PRD.md:**

```
## Section 8E -- External Transcript Hardening

### 8E.1 Overview

Candidates upload or paste conversation transcripts from any source -- real recruiter screening calls, practice sessions with other AI tools, LinkedIn message threads, interview debrief notes -- and the platform analyzes them to identify brain gaps and generate targeted expansion prompts.

This is the growth loop powered by external intelligence rather than internal testing.

### 8E.2 Input Interface

**Location:** `/dashboard/ai` -- "Harden Your Brain" section, below sandbox.

**Two input methods:**

**Text paste field:** Any format. No structure required. The candidate copies and pastes whatever they have -- rough notes, a formal transcript, a message thread. The AI reads it as plain text and extracts the relevant questions and answers.

**File upload:** TXT or PDF. For candidates who have saved formal chat logs or typed up interview notes.

**Submit button:** "Analyze and find gaps"

### 8E.3 Analysis Process

**API endpoint:** `POST /api/transcript/harden`

**Request:**
```typescript
{
  candidateProfileId: string,
  transcriptText: string,
  transcriptSource: 'paste' | 'file',
  sourceContext?: string    // optional: "phone screening with [Company]", "ChatGPT practice"
}
```

**Response:**
```typescript
{
  questionsFound: number,
  gapsIdentified: TranscriptHardeningGap[],
  strongCoverageConfirmed: string[],  // questions brain handles well
  hardeningPlan: HardeningAction[]    // prioritized list of what to do
}

type TranscriptHardeningGap = {
  questionFromTranscript: string,
  brainCoverageVerdict: 'strong' | 'adequate' | 'weak' | 'missing',
  expansionPrompt: string,
  brainFieldTarget: string,
  priority: 'high' | 'medium' | 'low'
}

type HardeningAction = {
  priority: number,
  action: string,           // plain language instruction
  brainFieldTarget: string,
  expansionPrompt: string,
  linkToField: string       // direct URL to field in dashboard
}
```

### 8E.4 Output -- Hardening Plan

The output is a prioritized action list, not a report. Three to five actions ranked by impact, each with a direct link to the brain field and a suggested expansion prompt.

Example output:

```
Your brain analyzed against 12 questions from this conversation.

3 gaps identified:

[HIGH] Budget and P&L authority
A recruiter asked about your financial responsibility and your brain only has 
a general statement. Add the specific dollar figures and scope.
→ Add context to Key Wins

[MEDIUM] First 90 days approach  
Asked how you approach a new leadership role and your brain has no answer 
for this common question.
→ Add a custom answer

[LOW] Team composition and hiring philosophy
Your brain covers team size but not how you build and evaluate teams.
→ Expand Leadership Philosophy
```

### 8E.5 Privacy Enforcement

- Uploaded transcript text processed server-side and not stored after analysis
- Analysis output (gaps, prompts) stored in `brain_hardening_sessions` table
- No recruiter identifying information stored in any table
- Privacy disclosure shown in UI before first upload
- Candidate can clear their hardening history at any time

### 8E.6 Re-analysis After Brain Updates

After the candidate addresses the gaps from a hardening session, they can re-run the analysis on the same transcript to confirm the gaps are closed. The re-run compares the new brain state against the same questions. Each re-run confirms progress and surfaces any remaining gaps.

### 8E.7 Data Model Additions

```sql
CREATE TABLE brain_hardening_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  transcript_source TEXT NOT NULL CHECK (transcript_source IN ('paste', 'file')),
  source_context TEXT,
  questions_found INTEGER NOT NULL DEFAULT 0,
  gaps_identified INTEGER NOT NULL DEFAULT 0,
  gaps_addressed INTEGER NOT NULL DEFAULT 0,
  hardening_plan JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_reanalyzed_at TIMESTAMPTZ
);

ALTER TABLE brain_hardening_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY hardening_sessions_owner ON brain_hardening_sessions
  FOR ALL TO authenticated
  USING (
    candidate_profile_id IN (
      SELECT id FROM candidate_profiles WHERE clerk_user_id = requesting_user_id()
    )
  );
```

### 8E.8 Phase and Priority

**Phase 3** -- builds after transcript delivery and sandbox are live.

Build sequence within Phase 3:
1. Text paste and file upload UI
2. Sonnet analysis call and gap extraction
3. Hardening plan display with direct field links
4. Privacy disclosure and data handling
5. Re-analysis after brain updates
6. History view of past hardening sessions
```

---

## Updated Summary of Changes

| File | Version Change | Key Updates |
|---|---|---|
| vision.md | 3.2 to 4.0 | Flagship reframed as AI brain. Calling card section added. Growth loop added. Moats updated. Fiverr framing updated. |
| PRD.md | 3.0 to 3.2 | Section 8B (AI Intake Interview) added. Section 8C (Transcript-to-Brain Loop) added. Section 8D (Sandbox and AI Fine-Tuning) added. Section 8E (External Transcript Hardening) added. Data model additions for all four sections. |
| CLAUDE.md | no version to v1.0 | Brain compartmentalization rule added. Voice transcription spec added. Hallucination prevention documented. MVP exclusions updated. |

**Note on PRD versioning:** The original spec targeted PRD v3.1. With Sections 8D and 8E added, PRD target version is now 3.2.

---

*RoleBoost AI Brain and Calling Card Spec v1.1 -- getroleboost.com -- Built by Rob Ramos -- June 2026*
