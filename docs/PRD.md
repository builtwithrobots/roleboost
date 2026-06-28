# PRD.md -- RoleBoost Product Requirements Document

**Version:** 3.0
**Last updated:** June 2026
**Author:** Rob Ramos
**Domain:** roleboost.app

---

## 1. Overview

RoleBoost empowers the candidate's voice to be heard before easy or automatic elimination by algorithm. Candidates upload their resume and career context, receive a full suite of AI-produced career assets, and get a personal career AI chatbot that represents them to recruiters 24/7. Resume Intelligence analyzes the resume and coaches candidates on exactly what context to add so their AI is armed before the first recruiter question. Every AI conversation generates a transcript delivered by email to both sides. Candidates fine-tune their AI over time. Employers get a candidate management dashboard with pipeline tracking, job postings, stage assignment, team collaboration, and AI chat access.

**Core user types:**
- **Candidate** -- job seeker uploading career assets, managing their AI, and sharing their profile link
- **Employer** -- hiring manager or recruiter saving candidates, managing pipeline, and chatting with candidate AIs

---

## 2. Authentication and Onboarding

### 2.1 Sign Up and Sign In

- Clerk handles all authentication
- Email/password and Google OAuth supported
- Single sign-up flow -- role declared in onboarding, not on sign-up page

**Acceptance criteria:**
- [ ] User can sign up with email and password
- [ ] User can sign up with Google
- [ ] User can sign in with email and password
- [ ] User can sign in with Google
- [ ] Successful sign-up redirects to onboarding
- [ ] Successful sign-in redirects to correct dashboard based on role

### 2.2 Onboarding -- Role Selection

After first sign-up, every user lands on the onboarding screen before any dashboard.

**Screen:** "How are you using RoleBoost?"

Two large tappable cards:
- "I am looking for my next role" -- sets role to `candidate`
- "I am hiring for my team" -- sets role to `employer`

On selection:
- Insert row into `users` with `clerk_user_id`, `email`, `role`
- Candidate: redirect to candidate onboarding (2.3)
- Employer: redirect to employer onboarding (2.4)

**Acceptance criteria:**
- [ ] Shown on first login only
- [ ] Both options keyboard accessible, minimum 44px touch target
- [ ] Role stored in `users.role` in Supabase
- [ ] Correct redirect after selection

### 2.3 Candidate Onboarding

Three-step flow before reaching the dashboard.

**Step 1 -- Basic info:**
- Full name (required)
- Location (city, state) (required)
- Target role (required)
- LinkedIn URL (optional)

**Step 2 -- Career headline:**
- Headline text field (max 200 chars)
- Helper text: "Example: Director of Operations | 20+ years warehouse leadership"

**Step 3 -- Profile slug:**
- Auto-generated from full name (e.g. `robert-ramos`)
- Editable -- unique, lowercase, alphanumeric and hyphens only
- Live preview: `roleboost.app/c/[slug]`

On completion:
- Insert row into `candidate_profiles`
- Redirect to `/dashboard/profile`

**Acceptance criteria:**
- [ ] Three-step flow with progress indicator
- [ ] All required fields validated
- [ ] Slug auto-generated and editable
- [ ] Slug uniqueness checked in real time
- [ ] Public URL preview shown before confirmation
- [ ] Profile row created in Supabase on completion
- [ ] Redirect to `/dashboard/profile`

### 2.4 Employer Onboarding

Two-step flow before reaching the dashboard.

**Step 1 -- Company info:**
- Company name (required)
- Industry (optional, dropdown)
- Approximate team size (optional, dropdown: 1-10, 11-50, 51-200, 200+)

**Step 2 -- Your role:**
- Your job title (required)
- How did you hear about us (optional)

On completion:
- Insert row into `employer_accounts`
- Insert row into `employer_members` with role `owner`
- Redirect to `/dashboard/candidates`

**Acceptance criteria:**
- [ ] Two-step flow with progress indicator
- [ ] Company name required
- [ ] `employer_accounts` and `employer_members` rows created
- [ ] User set as account owner
- [ ] Redirect to `/dashboard/candidates`

---

## 3. Candidate Features

### 3.1 Profile Tab

The main hub for managing profile content and sharing.

**Profile editor sections:**
- Basic info (name, location, target role, LinkedIn)
- Headline
- AI bullet summary (5-7 bullets -- manually entered or pasted from NotebookLM output)
- Profile visibility toggle (Published / Draft)

**Shareable assets section:**
- Full public URL: `roleboost.app/c/[slug]`
- Copy link button with confirmation toast
- QR code download button
- RoleBoost badge download button

**Acceptance criteria:**
- [ ] All fields editable and auto-saved on blur
- [ ] AI bullet summary supports up to 7 bullets, add/edit/reorder/delete
- [ ] Published/Draft toggle updates `candidate_profiles.is_published`
- [ ] Unpublished profiles return 404 on public URL
- [ ] Copy link copies URL to clipboard with confirmation toast
- [ ] QR code generates correctly and links to profile
- [ ] Badge downloads as PNG

### 3.2 Assets Tab

Where candidates upload career assets produced in NotebookLM.

**Asset types:**

| Asset | Accepted Formats | Max Size |
|---|---|---|
| Audio Overview | MP3, M4A, WAV | 50MB |
| Debate Audio | MP3, M4A, WAV | 50MB |
| Video Overview | MP4, MOV, WEBM | 500MB |
| Slide Deck | PDF | 25MB |
| Career Infographic | PNG, JPG, WEBP | 10MB |
| ATS Resume | PDF | 5MB |

Per asset: upload, preview, replace, delete. All candidates can upload all asset types.

**Acceptance criteria:**
- [ ] All six asset types uploadable
- [ ] File type and size validation before upload
- [ ] Upload progress indicator shown
- [ ] Asset stored in correct Supabase Storage bucket
- [ ] Asset record created in `candidate_assets` table
- [ ] Replace updates file and storage path
- [ ] Delete removes from storage and database
- [ ] All asset previews functional

### 3.3 AI Tab -- Career AI Management

The core candidate AI management interface. This is where candidates arm their chatbot.

**Resume Intelligence Panel (top of AI tab):**

Shown after resume upload. Analyzes the resume for what recruiters and ATS systems will flag and returns targeted context recommendations. See Section 8A for full spec.

- Displays flagged items ordered by severity (high / medium / low)
- Each flag shows: what a recruiter will notice, what to add, and a direct link to the relevant context field
- Completion bar tracks how many flags have been addressed
- Re-analyze available when target role changes or resume is updated

**Context form -- Career Intelligence:**

Guided by Resume Intelligence recommendations. Fields listed below. All optional except resume text and key wins.

- Resume text (required -- paste or upload)
- Top 5 career wins with specific numbers (required)
- Target role and target company type
- Leadership philosophy
- How you handle an underperforming team member
- Ideal team and work environment
- What you need from a manager to do your best work
- Why you left each of your last 3 roles
- Biggest professional challenge and what you did about it
- What you are not good at -- honest answer
- Questions you wish recruiters would ask you
- What defines your career in one sentence

**Custom answers:**
- List of question-answer pairs the candidate has refined based on recruiter transcript patterns
- Add, edit, and delete custom answers
- Custom answers are injected into the system prompt with highest priority

**Privacy controls:**
- Toggle: AI chat enabled / disabled for this profile
- Topics to redirect to direct conversation (add/remove list)
- Example redirects: salary expectations, references, availability date

**Testing interface:**
- "Test your AI" sandbox
- Candidate asks their own AI questions
- Sees exactly how it responds before going live
- Preview mode label: "This is how your AI responds to recruiters"

**Pattern insights (shown after first recruiter conversations):**
- Most asked questions this week
- Questions your AI redirected
- Suggestions for new custom answers based on patterns

**Acceptance criteria:**
- [ ] Resume Intelligence panel visible after resume upload
- [ ] Flags displayed ordered by severity
- [ ] Each flag CTA links directly to the relevant context field
- [ ] Completion bar updates as context fields are filled in
- [ ] All context fields saved to `candidate_profiles`
- [ ] Custom QA pairs stored as JSONB in `custom_qa_pairs`
- [ ] Privacy toggle updates `ai_enabled`
- [ ] Redirect topics stored in `redirect_topics` array
- [ ] Testing interface calls the same chat endpoint as recruiter chat
- [ ] Pattern insights shown after minimum 1 completed session
- [ ] All changes reflected immediately in AI responses

### 3.4 Transcripts Tab

Full history of all recruiter AI conversations.

**List view:**
- Company name (if employer logged in) or "Anonymous recruiter"
- Date and time
- Number of questions asked
- Duration
- Link to full transcript

**Full transcript view:**
- Every question asked and every AI answer
- Timestamp per message
- Link to fine-tune a specific answer

**Acceptance criteria:**
- [ ] All chat sessions shown reverse chronological
- [ ] Company name shown when employer was logged in
- [ ] Anonymous shown for unauthenticated viewers
- [ ] Full transcript readable inline
- [ ] Direct link from each question to AI fine-tuning interface

### 3.5 Analytics Tab

**Metrics:**
- Total profile views all time
- Views in last 7 days / 30 days
- Total AI chat sessions
- Average questions per session
- Asset play counts by type
- Most viewed time of day

**Acceptance criteria:**
- [ ] All metrics pulled from `profile_views` and `chat_sessions` tables
- [ ] Asset play counts tracked per asset type
- [ ] Anonymous views shown separately from employer views

### 3.6 Preview Tab

Shows the candidate exactly what recruiters see.

- Full modal rendered in preview frame
- "This is how recruiters see your profile" label
- Draft banner if profile is unpublished
- Chat tab functional in preview using candidate's own AI

**Acceptance criteria:**
- [ ] Modal renders identically to public `/c/[slug]`
- [ ] Chat interface functional in preview mode
- [ ] Draft banner shown for unpublished profiles

---

## 4. Public Candidate Profile -- The Modal

Core recruiter-facing experience at `/c/[slug]`.

### 4.1 Modal Behavior

- Full page with dark overlay background
- Modal centered -- 640px wide desktop, full screen mobile
- No login required to view
- Returns 404 for unpublished profiles

### 4.2 Modal Header

- Candidate initials avatar (colored circle, generated from name)
- Full name
- Headline
- Location and target role

### 4.3 AI Bullet Summary Panel

- Always visible below header, no tab click required
- 5-7 career snapshot bullets
- Labeled "Career snapshot"

### 4.4 Media Tabs

Tabs: Audio | Debate | Video | Deck | Infographic | Resume

Only tabs with uploaded assets are shown.

**Audio tab:** Custom player, play/pause, progress bar, seek, current time / total duration
**Debate tab:** Same custom player -- labeled "Hiring committee debate"
**Video tab:** Embedded player, play/pause, progress, fullscreen
**Deck tab:** PDF embed, scrollable, download button
**Infographic tab:** Full-width image, download button
**Resume tab:** "ATS-Ready Resume" label, download PDF button

All assets stream from signed Supabase Storage URLs (1-hour TTL, generated server-side).

### 4.5 Chat Tab -- Career AI

The AI chat interface embedded in the modal.

**Interface:**
- "Ask [Name]'s career AI anything" header
- Message input field
- Send button
- Conversation history in chat bubbles
- "Powered by RoleBoost AI" footer label
- Disclaimer: "This AI represents [Name]'s career history and may not reflect all details"

**Behavior:**
- Chat session created on first message
- All messages logged to `chat_messages`
- System prompt built from candidate's career data and custom QA pairs
- Claude Haiku generates all responses (fast, cheap, conversational)
- Session ends on modal close or 30 minutes of inactivity
- Transcript delivered by email to both sides on session end

**If AI disabled by candidate:**
- Chat tab hidden entirely

**Acceptance criteria:**
- [ ] Chat interface loads when Chat tab clicked
- [ ] Messages send and receive correctly
- [ ] Conversation history persists within session
- [ ] Session logged to `chat_sessions`
- [ ] All messages logged to `chat_messages`
- [ ] Transcript email sent to candidate after session ends
- [ ] Transcript email sent to logged-in employer after session ends
- [ ] Tab hidden if candidate has disabled AI
- [ ] Fully keyboard navigable
- [ ] Screen reader accessible

### 4.6 Employer Actions

Shown when employer is logged in:
- Save button -- saves to pool, changes to Saved with filled icon
- Connect button -- opens feedback compose
- Status dropdown -- assign stage (shown if already saved)
- Share button -- copies public URL

Unauthenticated viewers see Save and Connect -- clicking prompts sign up first.

### 4.7 View and Chat Tracking

Every modal open logs a view in `profile_views`.
Every chat session logs to `chat_sessions` with `employer_account_id` if logged in.
Duration tracked on modal close.

**Acceptance criteria:**
- [ ] View logged on every modal open
- [ ] Duration tracked on close
- [ ] Chat session created on first message
- [ ] Session closed and transcript triggered on modal close
- [ ] Fully keyboard navigable
- [ ] Focus trapped while open
- [ ] ESC closes modal
- [ ] WCAG 2.1 AA compliant

---

## 5. Employer Features

### 5.1 Candidates Tab

Saved candidate pool. Grid of candidate cards.

**Card shows:** Avatar, name, headline, stage badge, job posting, asset indicators, date saved

**Filters:** By job posting, by stage, by date saved
**Search:** By name or headline

Clicking card opens candidate modal inline.

**Acceptance criteria:**
- [ ] All saved candidates shown
- [ ] Filter and search functional
- [ ] Modal opens inline on card click
- [ ] Free tier limited to 5 saved candidates

### 5.2 Jobs Tab

**Job postings list:** Title, department, location, candidate count, active status

**Create/Edit form:** Title (required), department, location, description, active toggle

**Acceptance criteria:**
- [ ] All postings shown for employer account
- [ ] Create and edit functional
- [ ] Free tier limited to 1 posting

### 5.3 Board Tab

Candidate pool filtered by job posting, grouped by stage.

**Per candidate row:** Name, headline, asset indicators, date added, stage dropdown, notes field

Stage dropdown: Saved / Screening / Interview / Offer / Passed -- updates `saved_candidates.stage`

Notes auto-save on blur. Visible to all team members.

**Acceptance criteria:**
- [ ] Board shows candidates for selected posting only
- [ ] Stage dropdown updates database
- [ ] Notes auto-save
- [ ] Clicking name opens modal inline

### 5.4 Transcripts Tab

History of all AI chat conversations by employer team members.

**List view:** Candidate name, team member who chatted, date, question count
**Full transcript:** All questions and answers, link to save candidate, link to send feedback

**Acceptance criteria:**
- [ ] All chat sessions shown for employer account
- [ ] Full transcript readable
- [ ] Save candidate and send feedback CTAs functional

### 5.5 Team Tab

Available on Growth and Scale tiers.

**Team list:** Name, email, role, date added
**Invite flow:** Email input, Clerk invite email, auto-add on sign-up

**Acceptance criteria:**
- [ ] All `employer_members` shown
- [ ] Invite sends via Clerk
- [ ] Owner can remove members but not self
- [ ] Free and Starter tiers see locked state with upgrade CTA

### 5.6 Sending Feedback

From candidate modal (Connect button) or candidate card action menu.

**Compose:** Text area (max 1000 chars) with character counter, send button

**Acceptance criteria:**
- [ ] Compose accessible from modal and card
- [ ] Send creates feedback row
- [ ] Candidate receives email notification
- [ ] Candidate sees feedback in their dashboard
- [ ] Employer sees confirmation toast

---

## 6. Email Delivery -- Transcript System

### 6.1 Chat Session Lifecycle

1. Recruiter opens modal and sends first message -- `chat_sessions` row created
2. Messages logged in real time to `chat_messages`
3. Session ends when modal closes OR 30 minutes of inactivity
4. `POST /api/transcripts/deliver` called
5. Transcript built from all `chat_messages` in session
6. Email sent to candidate via Resend
7. Email sent to employer if logged in via Resend
8. `chat_sessions.transcript_sent` set to true

### 6.2 Candidate Transcript Email

**Subject:** A recruiter just chatted with your RoleBoost AI

**Body:**
- Company name (or "An anonymous recruiter") viewed your profile
- Date and time, number of questions asked
- Full conversation transcript
- Pattern insight if same question asked 3+ times this week
- CTA: Fine-tune your AI
- CTA: View full analytics

### 6.3 Employer Transcript Email

**Subject:** Your RoleBoost conversation with [Candidate Name]

**Body:**
- Summary -- N questions asked, duration
- Full conversation transcript
- CTA: View full profile
- CTA: Save candidate
- CTA: Send feedback

### 6.4 Feedback Notification Email

**Subject:** You have new feedback from [Company Name] on RoleBoost

**Body:**
- Company name and message preview
- CTA: Read full feedback

**Acceptance criteria:**
- [ ] Transcript email sent to candidate after every session
- [ ] Transcript email sent to logged-in employer after every session
- [ ] Feedback email sent to candidate on every feedback submission
- [ ] All emails from `transcripts@roleboost.app`
- [ ] Email templates mobile responsive
- [ ] Unsubscribe link included per CAN-SPAM

---

## 7. AI Chatbot System

### 7.1 System Prompt Construction

Built from `candidate_profiles` fields:

```
You are the career AI for [full_name]. You represent them professionally to recruiters
and hiring managers. Answer only from the career information provided below. If asked
something outside this data, redirect to direct conversation.

Never invent, embellish, or extrapolate beyond what is provided. If you do not know
the answer from the provided data, say so honestly and suggest the recruiter connect
directly.

CAREER INFORMATION:
[resume_text]

CAREER CONTEXT:
Target Role: [target_role]
Leadership Philosophy: [leadership_philosophy]
Key Wins: [key_wins]
Departure Reasons: [departure_reasons]
Biggest Challenge: [biggest_challenge]
Ideal Environment: [ideal_environment]
Manager Needs: [manager_needs]
Honest Weaknesses: [honest_weaknesses]
Wish Questions: [wish_questions]

CUSTOM ANSWERS (candidate-refined, highest priority):
[custom_qa_pairs formatted as Q: / A: pairs]

TOPICS TO REDIRECT:
[redirect_topics -- respond: "I would recommend connecting directly with [name]
to discuss this. You can reach them via the Connect button on their profile."]

Keep responses concise, warm, and grounded. No corporate speak.
Let the career data speak for itself.
```

### 7.2 Chat API

`POST /api/chat`

Request: `{ candidateSlug, message, sessionId, conversationHistory }`
Response: `{ answer, sessionId }`

Model: `claude-haiku-4-5-20251001` -- fast, cheap, conversational. Max tokens 500.

### 7.3 Fine-Tuning Data Model

`custom_qa_pairs` stored as JSONB array in `candidate_profiles`:

```json
[
  {
    "question": "Why did you leave Bedgear?",
    "answer": "The role was a startup build that I completed successfully. I established
    the systems, hired and trained the team, and handed off a running operation. I am most
    energized by building from zero and that chapter was complete."
  }
]
```

Custom answers injected into system prompt above base career data -- they take priority.

### 7.4 Privacy Controls

`redirect_topics` stored as `TEXT[]` in `candidate_profiles`.

`ai_enabled` BOOLEAN -- when false, Chat tab hidden entirely from modal.

---

## 8. Candidate Context Form -- Deep Career Questions

The intake form that trains the AI. Shown after initial onboarding. Guided by Resume Intelligence recommendations so candidates know which fields matter most for their specific resume.

**Section 1 -- Career highlights:**
- Paste your full resume or upload it (required)
- Top 5 career wins with specific numbers (required)
- Target role and target company type (required)

**Section 2 -- Leadership and work style:**
- Describe your leadership philosophy in your own words
- How do you handle an underperforming team member?
- What does your ideal team look like?
- What do you need from a manager to do your best work?

**Section 3 -- Honest answers recruiters appreciate:**
- Why did you leave each of your last 3 roles?
- What is your biggest professional failure and what did you learn?
- What are you not good at -- be honest?
- What question do you wish recruiters would ask you?

**Section 4 -- Your story:**
- What defines your career in one sentence?
- What gets you out of bed in the morning professionally?
- Where do you want to be in 5 years?

**Acceptance criteria:**
- [ ] All fields optional except resume text and key wins
- [ ] Auto-saves on blur
- [ ] Preview AI responses immediately after saving each section
- [ ] Progress indicator showing completion percentage
- [ ] Completion nudges shown -- "Your AI gives better answers with leadership context"
- [ ] Resume Intelligence panel visible above form after resume upload

---

## 8A. Resume Intelligence -- AI-Powered Context Recommendations

### 8A.1 Overview

Resume Intelligence is the layer between resume upload and the context form. When a candidate uploads or pastes their resume, Claude Sonnet analyzes it through the lens of what recruiters and ATS systems flag -- gaps, short tenures, career pivots, layoffs, missing degrees, title mismatches, skills without evidence, missing metrics -- and returns a targeted set of context-building recommendations.

The output is not a resume score. It is a prioritized list of questions the candidate's AI chatbot needs to be able to answer, derived directly from what is in the resume.

The framing to the candidate:

**"Based on your resume, here are the questions recruiters are likely to ask. Let's make sure your AI has the answers before they do."**

This is what empowers the candidate's voice to be heard before easy or automatic elimination by algorithm. Every context field filled in based on a Resume Intelligence recommendation is one fewer time a candidate has to answer that question defensively on a screening call.

### 8A.2 How It Works

**Trigger:** Candidate uploads or pastes resume text for the first time, or re-uploads an updated resume.

**Process:**
1. Resume text extracted from uploaded PDF or taken from paste field
2. `POST /api/resume-intelligence` with resume text and target role
3. Claude Sonnet analyzes resume against the recruiter and ATS flag rubric (see 8A.4)
4. Returns structured JSON containing flagged items and recommended context fields
5. Recommendations displayed in AI tab as prioritized list
6. Each recommendation links directly to the relevant context field
7. Completed recommendations marked with checkmark as candidate fills in context
8. Recommendations persist and update when candidate uploads a new resume

**API endpoint:** `POST /api/resume-intelligence`

**Request:**
```typescript
{
  resumeText: string,
  targetRole: string,
  candidateProfileId: string
}
```

**Response:**
```typescript
{
  flags: ResumeFlag[],
  completionScore: number,
  generatedAt: string
}

type ResumeFlag = {
  id: string,
  category: FlagCategory,
  severity: 'high' | 'medium' | 'low',
  title: string,
  explanation: string,
  recommendation: string,
  contextField: string,
  isAddressed: boolean
}

type FlagCategory =
  | 'employment_gap'
  | 'career_pivot'
  | 'layoff_or_rif'
  | 'no_degree'
  | 'short_tenure'
  | 'title_mismatch'
  | 'skills_without_evidence'
  | 'missing_metrics'
  | 'departure_reason'
  | 'overqualification'
  | 'underqualification'
  | 'returning_to_workforce'
```

### 8A.3 The Analysis Prompt

Claude Sonnet receives the following system prompt:

```
You are a senior recruiter and ATS specialist reviewing a candidate's resume. Your job
is to identify the specific things that will get flagged by ATS systems and human
recruiters during the screening process -- not to critique the candidate, but to help
them prepare their AI chatbot to answer these questions confidently before a recruiter
ever asks.

Analyze the resume against the following categories. For each flag identified, return
a structured object with: the category, severity, a plain-language title, an explanation
of what a recruiter or ATS will notice, a specific recommendation for what context to
add, and which context field that recommendation belongs in.

FLAG CATEGORIES:

employment_gap -- Any gap of 3+ months between roles. Severity: high if 12+ months,
medium if 6-12 months, low if 3-6 months. Context field: departure_reasons.

career_pivot -- Significant change in industry, function, or level unexplained by the
resume. Severity: high if unexplained and recent. Context fields: leadership_philosophy,
biggest_challenge.

layoff_or_rif -- Indication of reduction in force, company closure, or involuntary
separation. Severity: high (asked in first 60 seconds of every screening call).
Context field: departure_reasons.

no_degree -- Absence of degree where target role typically requires one.
Severity: high if degree commonly required, medium otherwise. Context field: key_wins.

short_tenure -- Any role under 18 months, especially if pattern of multiple.
Severity: medium to high. Context field: departure_reasons.

title_mismatch -- Gap between most recent title and target role -- significant step up
or step down. Severity: medium. Context fields: key_wins, leadership_philosophy.

skills_without_evidence -- Skills listed not supported by specific examples or outcomes.
Severity: medium. Context fields: key_wins, biggest_challenge.

missing_metrics -- Work experience describes responsibilities without quantified outcomes
in roles where numbers are expected. Severity: medium. Context field: key_wins.

departure_reason -- Role where departure reason is not obvious and likely to be asked.
Severity: medium. Context field: departure_reasons.

overqualification -- Candidate appears significantly more experienced than target role
requires. Severity: low to medium. Context fields: ideal_environment, manager_needs.

returning_to_workforce -- Out of workforce 12+ months, re-entering.
Severity: high. Context field: departure_reasons.

RULES:
- Return only flags genuinely present. Do not invent flags.
- Maximum 6 flags. Prioritize by severity and recruiter impact.
- High severity: recruiter asks in first 60 seconds of screening call.
- Medium severity: recruiter likely asks at some point.
- Low severity: ATS may flag but recruiter may not always ask.
- Keep explanations plain and direct. No hedging.
- Return valid JSON only. No preamble, no markdown fences.
```

### 8A.4 UI -- Resume Intelligence Panel

**Location:** AI tab, above the context form.

**States:**
- Not analyzed (no resume): muted panel with CTA to upload resume
- Analyzing: skeleton loader, "Analyzing your resume..."
- Results: prioritized flag cards with completion bar
- All addressed: green completion state

**Each flag card:**
- Severity dot (red = high, amber = medium, gray = low)
- Title
- Explanation (what a recruiter will notice)
- Recommendation (what to add)
- "Add context" CTA linking directly to the relevant context field
- Checkmark when context field is filled in (50+ characters)

**Completion bar:** "X of Y recruiter questions covered" -- fills as candidate addresses flags.

### 8A.5 Data Model Additions

```sql
ALTER TABLE candidate_profiles
  ADD COLUMN IF NOT EXISTS resume_intelligence_flags JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS resume_intelligence_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS resume_intelligence_run_at TIMESTAMPTZ;
```

A flag is considered addressed when its linked `contextField` in `candidate_profiles` is non-null and contains more than 50 characters. Score recalculates on every context field save.

### 8A.6 Trigger Points

- First resume upload: runs automatically
- Resume replacement: runs automatically, replaces prior flags
- Manual re-run: available from AI tab when target role changes

### 8A.7 Model and Cost

Model: `claude-sonnet-4-6` -- one-time generation per resume, not real-time chat.
Estimated cost: ~$0.02 per analysis (1,500 tokens input + 800 tokens output at Sonnet pricing).

### 8A.8 Acceptance Criteria

- [ ] Resume Intelligence panel visible in AI tab after resume upload
- [ ] Panel shows loading state during Claude API call
- [ ] Flags displayed ordered by severity
- [ ] Each flag card shows title, explanation, recommendation, and CTA
- [ ] CTA links to relevant context field and scrolls to it
- [ ] Completion bar updates as context fields are filled in
- [ ] Flags marked addressed when linked field has 50+ characters
- [ ] Panel shows completion state when all flags addressed
- [ ] Re-analysis available when target role changes
- [ ] New resume upload triggers automatic re-analysis
- [ ] Results stored in `candidate_profiles.resume_intelligence_flags`
- [ ] Score stored in `candidate_profiles.resume_intelligence_score`
- [ ] All UI meets WCAG 2.1 AA

### 8A.9 Phase and Priority

**Phase 3** -- builds on top of the context form and Claude API integration.
Build after the base context form is live and chat endpoint is working.
This is an enhancement layer, not a prerequisite.

---

## 9. Pricing and Feature Gates

### Candidate Tiers

Pricing TBD. Candidates generate real API costs at two points:
- Resume Intelligence (Claude Sonnet): approximately $0.02 per resume upload/re-analysis
- AI chatbot (Claude Haiku): approximately $0.0008 per recruiter chat session

The supply-side economics favor keeping candidates free or near-free to maximize profile volume and employer-side value. Final structure will be determined once usage patterns are understood from Fiverr validation.

| Feature | Free | Pro (TBD) |
|---|---|---|
| Full profile and all media assets | Yes | Yes |
| Shareable link, QR code, badge | Yes | Yes |
| Resume Intelligence | Yes | Yes |
| Basic AI chatbot | Yes | Yes |
| Transcript delivery by email | Yes | Yes |
| Basic fine-tuning -- edit custom answers | Yes | Yes |
| Advanced conversation analytics | No | Yes |
| Pattern recognition -- most asked questions | No | Yes |
| Custom chatbot personality settings | No | Yes |
| Priority profile placement | No | Yes |

### Employer Tiers

| Feature | Free | Starter $49 | Growth $99 | Scale $249 |
|---|---|---|---|---|
| AI chat with candidates | Yes | Yes | Yes | Yes |
| Transcript delivery by email | Yes | Yes | Yes | Yes |
| Saved candidates | 5 | 50 | Unlimited | Unlimited |
| Job postings | 1 | 5 | Unlimited | Unlimited |
| Transcript history in dashboard | No | Yes | Yes | Yes |
| Pipeline notes | No | Yes | Yes | Yes |
| Team collaboration | No | No | Yes | Yes |
| Chat analytics | No | No | Yes | Yes |
| API access | No | No | No | Yes |
| Priority support | No | No | No | Yes |

---

## 10. Paddle Integration

Candidate tier pricing TBD -- Paddle setup for candidate billing deferred until tier structure is finalized.

Employer billing active from launch.

| Variable | Tier |
|---|---|
| `PADDLE_EMPLOYER_STARTER_PRICE_ID` | Employer Starter $49/mo |
| `PADDLE_EMPLOYER_GROWTH_PRICE_ID` | Employer Growth $99/mo |
| `PADDLE_EMPLOYER_SCALE_PRICE_ID` | Employer Scale $249/mo |

Webhook handler at `/api/webhooks/paddle`.

Events: `subscription.created`, `subscription.updated`, `subscription.cancelled`, `subscription.payment.failed`

Always verify Paddle webhook signature before processing. Free tier limits enforced server-side on every relevant Server Action.

---

## 11. Storage

All buckets private. Signed URLs with 1-hour TTL generated server-side.

| Bucket | Max Size | Types |
|---|---|---|
| `candidate-audio` | 50MB | audio/mpeg, audio/mp4, audio/wav |
| `candidate-video` | 500MB | video/mp4, video/quicktime, video/webm |
| `candidate-documents` | 25MB | application/pdf |
| `candidate-images` | 10MB | image/png, image/jpeg, image/webp |

File path: `{clerk_user_id}/{timestamp}-{sanitized-filename}`

Signed URLs generated in Server Component on every modal load. Modal client receives pre-signed URLs -- never calls Supabase Storage directly.

---

## 12. Database Schema

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('candidate', 'employer')),
  email TEXT NOT NULL,
  paddle_subscription_id TEXT,
  subscription_status TEXT NOT NULL DEFAULT 'free'
    CHECK (subscription_status IN ('free', 'active', 'cancelled', 'past_due')),
  subscription_tier TEXT
    CHECK (subscription_tier IN ('pro', 'starter', 'growth', 'scale')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_self ON users
  FOR ALL TO authenticated
  USING (clerk_user_id = requesting_user_id())
  WITH CHECK (clerk_user_id = requesting_user_id());

-- Candidate profiles
CREATE TABLE candidate_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT NOT NULL UNIQUE REFERENCES users(clerk_user_id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
  full_name TEXT NOT NULL,
  headline TEXT CHECK (char_length(headline) <= 200),
  target_role TEXT,
  location TEXT,
  linkedin_url TEXT,
  resume_text TEXT,
  summary_bullets TEXT[] DEFAULT '{}',
  -- AI context fields
  leadership_philosophy TEXT,
  key_wins TEXT,
  departure_reasons TEXT,
  biggest_challenge TEXT,
  ideal_environment TEXT,
  manager_needs TEXT,
  honest_weaknesses TEXT,
  wish_questions TEXT,
  custom_qa_pairs JSONB DEFAULT '[]',
  redirect_topics TEXT[] DEFAULT '{}',
  ai_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  -- Resume Intelligence fields
  resume_intelligence_flags JSONB DEFAULT '[]',
  resume_intelligence_score INTEGER DEFAULT 0,
  resume_intelligence_run_at TIMESTAMPTZ,
  -- Profile settings
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE candidate_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY candidate_profiles_owner ON candidate_profiles
  FOR ALL TO authenticated
  USING (clerk_user_id = requesting_user_id())
  WITH CHECK (clerk_user_id = requesting_user_id());
CREATE POLICY candidate_profiles_public_read ON candidate_profiles
  FOR SELECT TO anon
  USING (is_published = TRUE);

-- Candidate assets
CREATE TABLE candidate_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  clerk_user_id TEXT NOT NULL REFERENCES users(clerk_user_id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL
    CHECK (asset_type IN ('audio', 'debate_audio', 'video', 'deck', 'infographic', 'resume')),
  storage_bucket TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes INTEGER,
  duration_seconds INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE candidate_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY candidate_assets_owner ON candidate_assets
  FOR ALL TO authenticated
  USING (clerk_user_id = requesting_user_id())
  WITH CHECK (clerk_user_id = requesting_user_id());

-- AI chat sessions
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  viewer_clerk_user_id TEXT REFERENCES users(clerk_user_id) ON DELETE SET NULL,
  employer_account_id UUID REFERENCES employer_accounts(id) ON DELETE SET NULL,
  employer_company_name TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  transcript_sent BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_sessions_candidate_read ON chat_sessions
  FOR SELECT TO authenticated
  USING (
    candidate_profile_id IN (
      SELECT id FROM candidate_profiles WHERE clerk_user_id = requesting_user_id()
    )
  );
CREATE POLICY chat_sessions_employer_read ON chat_sessions
  FOR SELECT TO authenticated
  USING (
    employer_account_id IN (
      SELECT employer_account_id FROM employer_members WHERE clerk_user_id = requesting_user_id()
    )
  );
CREATE POLICY chat_sessions_insert ON chat_sessions
  FOR INSERT TO anon, authenticated
  WITH CHECK (TRUE);

-- AI chat messages
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_messages_session_access ON chat_messages
  FOR ALL TO anon, authenticated
  USING (
    chat_session_id IN (
      SELECT id FROM chat_sessions
      WHERE
        candidate_profile_id IN (
          SELECT id FROM candidate_profiles WHERE clerk_user_id = requesting_user_id()
        )
        OR employer_account_id IN (
          SELECT employer_account_id FROM employer_members WHERE clerk_user_id = requesting_user_id()
        )
    )
  );

-- Employer accounts
CREATE TABLE employer_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  industry TEXT,
  team_size TEXT,
  created_by TEXT NOT NULL REFERENCES users(clerk_user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE employer_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY employer_accounts_members ON employer_accounts
  FOR ALL TO authenticated
  USING (
    id IN (
      SELECT employer_account_id FROM employer_members WHERE clerk_user_id = requesting_user_id()
    )
  );

-- Employer team members
CREATE TABLE employer_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_account_id UUID NOT NULL REFERENCES employer_accounts(id) ON DELETE CASCADE,
  clerk_user_id TEXT NOT NULL REFERENCES users(clerk_user_id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  invited_by TEXT REFERENCES users(clerk_user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(employer_account_id, clerk_user_id)
);

ALTER TABLE employer_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY employer_members_same_account ON employer_members
  FOR ALL TO authenticated
  USING (
    employer_account_id IN (
      SELECT employer_account_id FROM employer_members WHERE clerk_user_id = requesting_user_id()
    )
  );

-- Job postings
CREATE TABLE job_postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_account_id UUID NOT NULL REFERENCES employer_accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  department TEXT,
  location TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT NOT NULL REFERENCES users(clerk_user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE job_postings ENABLE ROW LEVEL SECURITY;
CREATE POLICY job_postings_employer_account ON job_postings
  FOR ALL TO authenticated
  USING (
    employer_account_id IN (
      SELECT employer_account_id FROM employer_members WHERE clerk_user_id = requesting_user_id()
    )
  );

-- Saved candidates
CREATE TABLE saved_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_account_id UUID NOT NULL REFERENCES employer_accounts(id) ON DELETE CASCADE,
  candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  job_posting_id UUID REFERENCES job_postings(id) ON DELETE SET NULL,
  stage TEXT NOT NULL DEFAULT 'saved'
    CHECK (stage IN ('saved', 'screening', 'interview', 'offer', 'passed')),
  notes TEXT,
  saved_by TEXT NOT NULL REFERENCES users(clerk_user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(employer_account_id, candidate_profile_id)
);

ALTER TABLE saved_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY saved_candidates_employer_account ON saved_candidates
  FOR ALL TO authenticated
  USING (
    employer_account_id IN (
      SELECT employer_account_id FROM employer_members WHERE clerk_user_id = requesting_user_id()
    )
  );

-- Feedback
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_account_id UUID NOT NULL REFERENCES employer_accounts(id) ON DELETE CASCADE,
  candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  sent_by TEXT NOT NULL REFERENCES users(clerk_user_id),
  message TEXT NOT NULL CHECK (char_length(message) <= 1000),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY feedback_employer ON feedback
  FOR ALL TO authenticated
  USING (
    employer_account_id IN (
      SELECT employer_account_id FROM employer_members WHERE clerk_user_id = requesting_user_id()
    )
  );
CREATE POLICY feedback_candidate_read ON feedback
  FOR SELECT TO authenticated
  USING (
    candidate_profile_id IN (
      SELECT id FROM candidate_profiles WHERE clerk_user_id = requesting_user_id()
    )
  );
CREATE POLICY feedback_candidate_update ON feedback
  FOR UPDATE TO authenticated
  USING (
    candidate_profile_id IN (
      SELECT id FROM candidate_profiles WHERE clerk_user_id = requesting_user_id()
    )
  )
  WITH CHECK (TRUE);

-- Profile views
CREATE TABLE profile_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  viewer_clerk_user_id TEXT REFERENCES users(clerk_user_id) ON DELETE SET NULL,
  employer_account_id UUID REFERENCES employer_accounts(id) ON DELETE SET NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_seconds INTEGER
);

ALTER TABLE profile_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY profile_views_candidate_read ON profile_views
  FOR SELECT TO authenticated
  USING (
    candidate_profile_id IN (
      SELECT id FROM candidate_profiles WHERE clerk_user_id = requesting_user_id()
    )
  );
CREATE POLICY profile_views_insert ON profile_views
  FOR INSERT TO anon, authenticated
  WITH CHECK (TRUE);
```

---

## 13. Accessibility Requirements

All UI must meet WCAG 2.1 AA. Non-negotiable.

- Minimum 44px touch targets on mobile
- Minimum 4.5:1 contrast ratio for normal text
- Minimum 3:1 for large text and UI components
- All interactive elements keyboard accessible
- All images have meaningful alt text or `aria-hidden="true"` for decorative
- Focus indicators visible on all focusable elements
- Focus trapped inside modal while open
- ESC closes modal and returns focus to trigger
- All form inputs have associated `<label>` elements
- Error messages associated with inputs via `aria-describedby`
- No information conveyed by color alone

---

## 14. Build Phases

### Phase 0 -- Foundation (Week 1-2)
- [ ] Initialize Next.js with TypeScript and Tailwind
- [ ] Configure Clerk
- [ ] Configure Supabase with Clerk third-party auth
- [ ] Run all database migrations (all tables from Section 12)
- [ ] Create Supabase Storage buckets
- [ ] Configure Resend domain and sending address
- [ ] Set up Vercel under `builtwithrobots`
- [ ] Configure all environment variables

### Phase 1 -- Candidate Profiles and Modal (Week 2-4)
- [ ] Onboarding -- role selection
- [ ] Candidate onboarding -- 3 steps
- [ ] Candidate dashboard layout and navigation
- [ ] Profile editor (Section 3.1)
- [ ] Asset upload (Section 3.2)
- [ ] Public modal at `/c/[slug]` (Section 4, without chat tab)
- [ ] View tracking
- [ ] QR code generation
- [ ] Badge download

### Phase 2 -- Employer Dashboard (Week 4-7)
- [ ] Employer onboarding -- 2 steps
- [ ] Employer dashboard layout
- [ ] Candidates tab (Section 5.1)
- [ ] Save candidate from modal
- [ ] Jobs tab (Section 5.2)
- [ ] Board tab (Section 5.3)
- [ ] Stage assignment
- [ ] Notes
- [ ] Feedback compose and send (Section 5.6)
- [ ] Feedback notification email via Resend

### Phase 3 -- AI Chatbot, Transcripts, Resume Intelligence (Week 7-10)
- [ ] Candidate context form (Section 8)
- [ ] Resume Intelligence -- Claude Sonnet analysis (Section 8A)
- [ ] Resume Intelligence panel UI in AI tab
- [ ] System prompt builder -- `lib/ai/build-system-prompt.ts`
- [ ] Claude Haiku chat endpoint -- `/api/chat`
- [ ] Chat UI in modal -- Chat tab (Section 4.5)
- [ ] Chat session and message logging
- [ ] Candidate AI tab -- full management interface (Section 3.3)
- [ ] Fine-tuning interface -- custom QA pairs
- [ ] Privacy controls -- redirect topics and `ai_enabled` toggle
- [ ] Testing sandbox -- candidate tests their own AI
- [ ] Transcript delivery endpoint -- `/api/transcripts/deliver`
- [ ] Candidate transcript email template
- [ ] Employer transcript email template
- [ ] Transcripts tab for candidates (Section 3.4)
- [ ] Transcripts tab for employers (Section 5.4)
- [ ] Pattern recognition -- most asked questions
- [ ] Mobile responsive audit
- [ ] WCAG 2.1 AA audit

### Phase 4 -- Payments and Polish (Week 10-12)
- [ ] Paddle JS integration for employer tiers
- [ ] Employer upgrade prompts at free tier limits
- [ ] Checkout flow
- [ ] Paddle webhook handler (Section 10)
- [ ] Subscription status gates on features
- [ ] Billing management via Paddle customer portal
- [ ] Error states and empty states for all screens
- [ ] Loading and skeleton screens
- [ ] Analytics tab (Section 3.5)
- [ ] Candidate pricing decision and tier implementation (TBD)

---

## 15. Out of Scope for MVP

Do not build. Push back if asked.

- AI asset generation on platform -- NotebookLM is the production engine
- Drag and drop Kanban -- dropdown stage assignment only
- Employer candidate browse directory -- save via shared links only
- Resume parsing or ATS keyword optimization (distinct from Resume Intelligence)
- Video or audio recording in browser
- Real-time chat notifications -- email transcripts are the delivery mechanism
- Voice cloning for AI chatbot
- Multi-language support
- Native mobile app
- Social features or endorsements
- External ATS integrations (Workday, Greenhouse, Lever)
- Job description gap analysis feature -- post-MVP, pending Claude API candidate-paste flow
