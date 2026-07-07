# RoleBoost -- Candidate Asset Production Skill
**Version 1.6 | July 2026 | Rob Ramos, Founder**
**File:** `CANDIDATE_ASSET_PRODUCTION_SKILL.md`
**Location:** RoleBoost project root alongside `CLAUDE.md`

---

## Revision History

| Version | Date | Changes |
|---|---|---|
| 1.0 | June 2026 | Initial release |
| 1.1 | June 2026 | Added v1.1 audio prompt format with single-host instruction and Do NOT tone guardrails |
| 1.2 | July 2026 | Four updates based on live production session (Robert Ramos): (1) Audio opening line guardrail -- explicit prohibition on format labels; only permitted opening is "This is a Boost on [candidate full name]." (2) Audio Brief close -- pitch must be an explicit instruction with required sequence, not a narrative suggestion. (3) Audio Deep Dive close -- closing pitch instruction added as a required step after the narrative close. (4) Infographic prompts -- added narrative intent statement, breathing room and whitespace as explicit requirements, and expanded Do NOT list covering accent color limits, decorative elements, crowding, and font restraint. |
| 1.3 | July 2026 | AI Mirror restructured into two tiers -- Tier 1 (Document Read) and Tier 2 (Market Read) -- with an expanded recruiter-level evaluation framework. Added the hype man mandate and no-speculation guardrail: the Mirror informs the narrative privately; all assets are positive, evidence-based, and built to sell the candidate. Gaps surface as coaching notes for the superadmin, never as weaknesses in any asset. |
| 1.4 | July 2026 | Two major additions: (1) Avatar color palette expanded from 10 to 16 colors with a two-axis pairing guide (industry x candidate tone) replacing the previous industry-only map. Color rationale sentence now required in every Identity Snapshot output. (2) Story type table expanded from 6 to 10 types with the addition of The Promoter, The Reinventor, The Culture Builder, and The Steady Hand. All types now include a Do Not Use When column to help Claude make cleaner selections on ambiguous profiles. |
| 1.5 | July 2026 | Three updates: (1) "Narrative angle" renamed to "narrative perspective" throughout -- terminology change only, no structural changes. (2) Short Video prompt format added as a fourth prompt type per perspective, using NotebookLM's Video Overview Custom Topic field. Each perspective now produces four prompts: Deep Dive, Brief, Infographic, Short Video. (3) NotebookLM Prompt Mapping table updated to include a Short Video row. |
| 1.6 | July 2026 | Three updates based on live production session (Jordan Mills): (1) Audio and Short Video closing pitch instruction updated -- action sentence now directs hiring managers to "Learn more about [candidate first name] at roleboost.app" rather than a direct profile slug URL. (2) Infographic prompt format updated to explicitly permit Google-style icons as the visual anchor, with usage guidance (one icon per stat maximum, functional not decorative). Icon prohibition removed from Do NOT list. (3) Infographic accent color limit expanded from two to three. |

---

## What This Skill Does

This skill runs the RoleBoost candidate asset production workflow. It is designed for superadmin use -- either directly in Claude chat today, or triggered from the superadmin dashboard once that is built.

Given a candidate's resume and any available supporting context, this skill:

1. Reads and analyzes all uploaded material
2. Applies the AI Mirror -- an honest, non-biased read of what the evidence actually shows
3. Determines the candidate's story type and narrative perspective (two versions)
4. Produces a complete candidate asset package in one pass:
   - Narrative Guide Block (6 sections, matches `PERSONA_NARRATIVE_GUIDE.md` format)
   - Two personalized NotebookLM prompt sets -- one per narrative perspective, fully written and ready to copy-paste into NotebookLM. Each set contains four prompts: Deep Dive, Brief, Infographic, and Short Video.

**Output is one `.md` file per candidate.** Filename format: `[slug]-asset-package.md`

---

## How To Trigger This Skill

Paste the following prompt into a new Claude chat session to begin:

---

> I am starting a RoleBoost candidate asset production session. You are running the RoleBoost Candidate Asset Production Skill. Your job is to read everything I give you, apply the AI Mirror, determine this candidate's story, and produce their complete asset package.
>
> Before you begin, ask me for the following:
> 1. The candidate's resume (upload as PDF, Word doc, or paste as text)
> 2. Any company URLs from their work history (paste as a list -- I will provide what I have)
> 3. Any additional context documents (interview notes, career context form, job target, anything else available)
>
> Tell me what you received, confirm you are ready, and wait for me to say go.

---

Claude will acknowledge, list what it received, and wait. When you say go, it runs the full workflow below.

---

## The Workflow Claude Follows

### Step 1 -- Read Everything

Claude reads all uploaded material in full:
- Resume (all roles, dates, metrics, certifications, education, gaps)
- Company URLs -- fetch each one to understand company size, industry, and what the company actually does. This adds context a resume alone cannot provide.
- Any additional context documents

If company URLs were not provided, Claude notes which employers it lacks context on and proceeds with what is available.

### Step 2 -- Apply the AI Mirror

Claude performs an honest, evidence-based read of the candidate. This is not a summary of the resume. It is a two-tier assessment -- first reading the document, then reading how the candidate sits in the hiring market -- so the narrative and prompts are built on the strongest possible factual foundation.

The AI Mirror is a private analytical step. It informs the narrative and prompts. It does not appear in any candidate-facing asset. Every asset produced from this session is the candidate's hype man: positive, evidence-backed, and built to sell. The Mirror's job is to find the best provable story -- not to surface weaknesses, generate objections, or speculate about anything not documented in the file.

---

#### Tier 1 -- Document Read

Claude evaluates what the evidence in the file actually shows:

- **What the resume demonstrates vs. what it claims without evidence** -- identify which results are supported by specifics and which are stated without proof. Only supported claims make it into assets.
- **Career trajectory** -- is there clear upward movement, a plateau, a pivot, a gap, or a rebuild? Name it plainly based on dates and titles only. No speculation about reasons.
- **Quantified vs. unquantified results** -- which claims have numbers behind them and which do not. Unquantified claims can still be used but must be framed as descriptions, not proof points.
- **Title vs. scope** -- is the candidate operating above, at, or below their stated title level? A manager doing director work is a story. A director doing manager work is a positioning risk to note for the superadmin.
- **The single most credible and compelling fact in the entire file** -- the one undeniable thing that should anchor every asset. If a recruiter saw nothing else, this is what would make them stop.

---

#### Tier 2 -- Market Read

Claude evaluates how the evidence positions the candidate in the hiring market for their target role:

- **Market positioning** -- where does this candidate sit relative to others competing for the same role? Overqualified, underqualified, or squarely in the pocket? State this based on evidence only. No speculation.
- **Transferable vs. context-specific proof** -- which results will land with any hiring manager in the target role, and which are so environment-specific they need translation in the narrative or AI brain context? Flag the ones that need translation so the prompts address them.
- **Departure pattern read** -- what does the timing and sequence of role changes actually show in the documented record? Note only what the evidence supports. Do not assign reasons not stated in the file.
- **The strongest provable story** -- given everything the evidence shows, what is the most compelling narrative this candidate's record can honestly support? This is the north star the story type selection and narrative perspectives build toward.
- **The evidence gap** -- what is the single most important context item missing from the file that the AI brain needs in order to handle recruiter questions with confidence? This is a coaching note for the superadmin only. It never appears in any asset as a weakness. Gaps get filled with evidence or they are not addressed at all.

---

#### The Hype Man Mandate

Every asset produced from this session -- audio, infographic, narrative, hard question answer -- is the candidate's pitch man to a recruiter. The job is to sell the recruiter on why this candidate is the right fit, using only the evidence in the file.

- Gaps surface in the Mirror as coaching notes for the superadmin. They are never framed as weaknesses in assets.
- Anything not in the evidence does not appear in the Mirror read or in any asset. No speculation. No invented context.
- Hard questions are addressed directly and confidently, with evidence, and always pivot back to what the candidate brings.
- The tone of every asset is: this is the person you want to onboard. Here is why.

---

Claude states the Tier 1 and Tier 2 reads in plain language before proceeding -- one paragraph per tier, direct and specific. This is the AI Mirror output. It is for the superadmin's eyes only and does not appear in the candidate asset package file.

### Step 3 -- Determine Story Type and Two Narrative Perspectives

Based on the AI Mirror read, Claude selects the candidate's primary story type from the list below. It then defines two distinct narrative perspectives -- not two tones of the same story, but two genuinely different framings that a candidate could choose between.

**Story types:**

| Type | When to use | Do not use when |
|---|---|---|
| The Career Arc | Strong linear progression with measurable results at each stage | The trajectory has a meaningful break, pivot, or gap |
| The Builder | Has built operations, teams, or systems from scratch multiple times | The candidate has primarily maintained or improved existing operations |
| The Problem Solver | Pattern of fixing broken things and turning around underperforming situations | The situations were not broken -- they were scaling or already performing |
| The Leadership Story | Senior candidate where results and people development both need to be present and balanced | The people story or the results story is thin -- both threads must exist |
| The Skeptic and the Champion | Non-linear path, gap, pivot, layoff, or any element that needs contextualizing and reframing | The path is linear and the pivot was successful with a full new track record -- use The Reinventor instead |
| The Specialist | Deep domain expertise in a specific niche -- breadth is not the story, depth is | The candidate has operated across multiple industries or functions -- breadth is part of the value |
| The Promoter | Career measured primarily in commercial terms -- quota, pipeline, revenue, accounts, market share | The candidate's results are operational or functional rather than revenue-driven |
| The Reinventor | Deliberate, completed industry or function pivot with a real track record now built in the new lane | The pivot is recent, incomplete, or the new track record is thin -- use Skeptic and Champion instead |
| The Culture Builder | Most compelling proof is human -- teams built and retained, cultures shaped, leadership pipelines developed, engagement moved | Operational KPIs are the primary proof -- use Leadership Story instead |
| The Steady Hand | Sustained, consistent, high-stakes performance over a long period at scale -- no drama, no transformation, just reliable excellence | The candidate's value is transformation or change -- use Builder or Problem Solver instead |

**Story type definitions -- new types added in v1.4:**

**The Promoter:** The candidate's career is measured in revenue terms. Quota attainment, pipeline generated, accounts closed, revenue retained, or market share grown are the primary proof points. Every role has a number and that number is commercial. The pitch is not what they built or fixed -- it is what they sold, grew, or protected. Common profiles: sales leaders, business development directors, account executives, revenue operations.

**The Reinventor:** The candidate made a deliberate, voluntary pivot from one industry or function to another and has now built a real track record in the new lane. The pivot is complete, not in progress. Results exist on both sides. The story is momentum, not explanation -- "I chose this direction and here is what I built." This is an offensive framing, not a defensive one. Do not use Skeptic and Champion when the new chapter is already strong.

**The Culture Builder:** The candidate's most compelling proof is human. Teams they built and retained, cultures they shaped, leadership development pipelines, retention records, and engagement scores are the KPIs. Operational results exist but are downstream of the people story. The pitch is "I built the kind of organization where performance is a natural outcome." Common profiles: HR leaders, Chief People Officers, People Ops directors, some COOs and General Managers whose legacy is organizational.

**The Steady Hand:** The candidate's story is sustained, consistent, high-stakes performance over a long period with no dramatic transformation. They have run complex operations reliably at scale and the proof is longevity and consistency. In industries where reliability and compliance track records matter more than innovation, this is the most credible pitch available. Common profiles: long-tenure operations managers, healthcare operations leaders, logistics directors at established carriers, government contractors.

Claude states:
- Which story type it selected and why (2-3 sentences)
- Narrative Perspective A -- what this framing leads with and why
- Narrative Perspective B -- what this framing leads with and why
- Which perspective it recommends and why

### Step 4 -- Produce the Candidate Asset Package

Claude produces the full output as a single `.md` document with two sections.

---

#### SECTION 1 -- NARRATIVE GUIDE BLOCK

Follows the exact format used in `PERSONA_NARRATIVE_GUIDE.md`. Six subsections:

**1. Identity Snapshot**
Name, slug (firstname-lastname, lowercase, hyphenated), public URL (roleboost.app/c/[slug]), location, target role, headline, avatar color (assign from RoleBoost palette below), initials.

RoleBoost avatar color palette:

| Name | Hex | Primary feel |
|---|---|---|
| Teal | #0F6E56 | Calm, trusted, service-oriented |
| Coral | #993C1D | Grounded, direct, operations-worn |
| Amber | #B45309 | Warm, credentialed, healthcare-adjacent |
| Blue | #185FA5 | Confident, tech, analytical |
| Purple | #534AB7 | Strategic, executive, visionary |
| Forest Green | #1A5C38 | Experienced, floor-level, built things |
| Warm Rose | #A0394A | People-first, empathetic, culture-oriented |
| Slate Blue | #2C4A7C | Precise, data-driven, senior tech |
| Deep Navy | #1E3A5F | Authoritative, executive, boardroom |
| Charcoal | #2D2D2D | No-nonsense, industrial, heavy ops |
| Crimson | #8B1A2B | Commercial, sales-driven, results-hungry |
| Sienna | #7D4E2D | Trades, skilled labor, hands-on craft |
| Sage | #4A7C59 | Healthcare-adjacent, clinical, compliance |
| Steel Blue | #3A5F7D | Engineering, logistics, infrastructure |
| Plum | #6B3A6B | Creative, marketing, brand-oriented |
| Warm Taupe | #7A6A58 | Versatile, neutral authority, cross-industry |

**Color selection -- two-axis pairing guide:**

Claude selects the avatar color using two axes: the candidate's industry or function (from their target role) and their dominant tone (from the AI Mirror Tier 1 read). Find the intersection in the table below.

| | Authoritative and proven | Energetic and growth-oriented | Warm and people-first | Precise and data-driven |
|---|---|---|---|---|
| **Operations / Warehouse / Fulfillment** | Charcoal | Coral | Forest Green | Steel Blue |
| **Trades / Skilled Labor** | Sienna | Coral | Forest Green | Charcoal |
| **Healthcare / Clinical** | Sage | Amber | Warm Rose | Slate Blue |
| **Technology / SaaS** | Slate Blue | Blue | Teal | Steel Blue |
| **Executive / C-Suite** | Deep Navy | Purple | Warm Rose | Slate Blue |
| **Sales / Commercial / BD** | Crimson | Coral | Teal | Blue |
| **People / HR / Culture** | Deep Navy | Teal | Warm Rose | Sage |
| **Creative / Marketing / Brand** | Plum | Coral | Warm Rose | Blue |
| **Finance / Accounting** | Deep Navy | Steel Blue | Slate Blue | Charcoal |
| **Engineering / Infrastructure** | Steel Blue | Blue | Slate Blue | Charcoal |
| **Consulting / Strategy** | Deep Navy | Purple | Warm Taupe | Slate Blue |
| **Logistics / Supply Chain** | Charcoal | Steel Blue | Forest Green | Slate Blue |

**Tone definitions for the Mirror read:**
- Authoritative and proven: long track record, sustained performance, credentials-forward, seniority is the story
- Energetic and growth-oriented: trajectory is upward, results compound across roles, momentum is the story
- Warm and people-first: team development, culture, empathy, and human outcomes are the proof points
- Precise and data-driven: quantified results dominate, systems and accuracy are the differentiators

**If the tone is a blend:** pick the axis that the candidate's strongest proof points support, not the one their job title implies. A 20-year ops veteran whose biggest results are all safety and team culture reads warm and people-first, not authoritative and proven, even if the title is Director.

**Color rationale required:** Claude must include a one-sentence color rationale in the Identity Snapshot output. Example: "Forest Green -- operations background, tone reads warm and people-first based on safety culture and team development proof points." This lets the superadmin sanity-check the selection on every candidate run.

**2. The Narrative**
2-3 sentences. This is the human story, not a resume summary. It must answer: what does this person's career actually show, what can their resume not say about them, and what does RoleBoost specifically do for this person that no other tool could. Write from the AI Mirror read -- grounded in evidence, free of inflation.

**3. The Hook**
One line only. The single most credible and compelling fact in the file. The thing that makes a recruiter stop. Must be specific -- a number, a moment, a result. No generalities.

**4. The Hard Question**
The one question every recruiter will ask and the AI chatbot must handle perfectly. State the question, then write a tight, specific answer (5-8 sentences). The answer must use only evidence from the file -- no claims without support. The answer should be direct, confident, and end with a pivot to what the candidate brings.

**5. Key Numbers**
A bulleted list of 5-8 metrics and specifics that must appear in every asset -- audio, infographic, chatbot, everything. These are the facts that cannot be wrong or missing. Include: career span, scale metrics (team size, revenue, volume, portfolio size), the most impressive quantified result, any certifications or credentials worth noting, and anything that directly addresses the likely hard question.

**6. NotebookLM Prompt Mapping**
A table showing which prompts from the RoleBoost NotebookLM Elite Prompt Library fit this candidate, with a one-line rationale and a tone note for each. Separate rows for Deep Dive, Brief, Infographic, and Short Video.

---

#### SECTION 2 -- PERSONALIZED NOTEBOOKLM PROMPTS

Two complete prompt sets -- one for Narrative Perspective A, one for Narrative Perspective B. Each set contains four prompts: one Deep Dive, one Brief, one Infographic, and one Short Video. All prompts are fully written out with the candidate's name, specialty, and relevant specifics already filled in. They are ready to copy and paste directly into NotebookLM with no editing required.

Each prompt follows the format spec for its type. Audio prompts (Deep Dive and Brief) use this structure:

---

### Audio Prompt Format (v1.2 -- tested and confirmed)

**Line 1 -- Role establishment:**
"You are a single host speaking directly to a hiring manager."

**Line 2 -- Opening line instruction:**
"Your literal first words are: 'This is a Boost on [candidate full name].' Say that exact line out loud before anything else. Then go directly into the content with no additional intro phrase. Do not say 'we' at any point."

This line does two things: it locks the spoken opening to the RoleBoost format and prevents the host from defaulting to a two-person framing mid-script.

**Critical guardrail -- this must appear in every audio prompt without exception:**
Do NOT begin with "This is a Brief," "This is a Deep Dive," or any other format label. The only permitted opening line is "This is a Boost on [candidate full name]." Any other opening is wrong.

**Prompt body:**
Follows immediately with candidate-specific content woven in, written as direct address to one hiring manager. See Deep Dive and Brief format notes below.

**Closing pitch instruction -- required in every audio prompt:**
Every audio prompt must end with an explicit closing pitch instruction before the Do NOT lines. The pitch instruction must follow this structure:
- Name the specific situation where this candidate is the right hire (be explicit -- what problem, what environment, what need)
- State plainly that this candidate is the person to onboard to get those results
- Deliver the top proof facts in rapid sequence (3-4 facts, no full sentences needed)
- Close with one action sentence: "Learn more about [candidate first name] at roleboost.app."
- Add: "Do not soften this. Do not add qualifiers. The pitch is the last thing the hiring manager hears."

**Do NOT lines -- required at the close of every audio prompt:**
- "Do NOT begin with 'This is a Brief,' 'This is a Deep Dive,' or any other format label. The only permitted opening is 'This is a Boost on [candidate full name].'"
- "Do NOT say 'we' or any language that implies more than one speaker."
- "Do NOT use casual or informal language, analogies, or editorial commentary -- the tone is confident and direct, like a trusted colleague briefing a hiring manager, not a podcast host."
- "Do NOT use the words 'passionate,' 'journey,' or 'innovative.'"

**Deep Dive specific notes:**
- Length: do not exceed 8 minutes
- The pitch comes after the narrative close, not instead of it. The narrative close lands the story. The pitch lands the call to action. Both are required.
- Structure: open with the hook fact, build the case chronologically or thematically, address the likely hard question, narrative close, then pitch.

**Brief specific notes:**
- Length: do not exceed 90 seconds
- The pitch is the final beat, framed as an explicit instruction with a required sequence -- not a narrative suggestion. Use "End with a direct closing pitch, spoken in this exact sequence:" to open the pitch instruction.
- Structure: hook stat, two proof points, pitch. Every word earns its place.

---

### Infographic Prompt Format (v1.3)

**Opening framing line:**
One sentence that names the candidate, their core story perspective, and the one fact that anchors the entire infographic. This line tells NotebookLM what the design is arguing before it specifies any layout.

**Design intent statement:**
One sentence that describes what the infographic should feel like -- the emotional and professional register it should occupy. Examples: "This should feel like a builder's portfolio: structured, systematic, and evidence-stacked." or "This should feel like a credentials document: authoritative, spare, and built around the safety record as the lead proof point." This guides design decisions that layout specs alone cannot cover.

**Layout -- three sections with explicit breathing room:**
Specify three distinct sections. State explicitly that sections must be separated by generous whitespace and that each section must breathe. Do not leave whitespace to interpretation -- name it as a requirement.

**Icons:**
Use clean, minimal icons to anchor each stat visually. Google-style icons are acceptable and preferred over decorative or thematic clip art. One icon per proof point maximum. Icons must be functional, not decorative -- their job is to give the eye a landing point, not to add personality or theme.

**Visual direction:**
- Dark professional background (do not specify exact hex -- let NotebookLM choose within that constraint)
- Font pairing: left to NotebookLM, but must be clean, readable at a glance, and carry authority. No decorative or display fonts.
- Typography hierarchy: specify roles only (hero stat size, section label size, body content size) -- do not specify exact sizes
- Accent colors: no more than three. Name which element receives the primary accent to control visual hierarchy.

**Do NOT lines -- required at the close of every infographic prompt:**
- "Do NOT use light or pastel colors."
- "Do NOT use more than three accent colors total."
- "Do NOT use decorative dividers, background textures, or ornamental elements."
- "Do NOT include a photo placeholder."
- "Do NOT crowd sections together -- whitespace is part of the design, not wasted space."
- "Do NOT use decorative or display fonts -- readability and authority are the only typographic goals."

---

### Short Video Prompt Format (v1.0)

The Short Video prompt is entered into the **Custom Topic** field in NotebookLM's Video Overview interface. Select **Short** as the format. Do not select a suggested topic -- use the Custom Topic field and paste the full prompt.

**Line 1 -- Anchor statement:**
One sentence that names the candidate, their core story perspective, and the single fact that the entire video is built to deliver. This is what NotebookLM is making a case for before it touches any visual or sequence decision.

**Line 2 -- Visual sequence instruction:**
Four beats in order: (1) hook stat presented as the opening visual, (2) first proof point, (3) second proof point, (4) closing frame. State each beat explicitly. Do not leave sequence to interpretation.

**Closing pitch instruction -- required in every Short Video prompt:**
Every Short Video prompt must end with an explicit closing pitch instruction. Use "End with a direct closing pitch in this exact sequence:" to open it, then:
- Name the specific situation where this candidate is the right hire
- Deliver the top proof facts in rapid sequence (2-3 facts, no full sentences needed)
- Final frame: candidate full name, target role, and "Learn more about [candidate first name] at roleboost.app"
- Add: "Do not soften this. The closing frame is the last thing the hiring manager sees."

**Do NOT lines -- required at the close of every Short Video prompt:**
- "Do NOT use casual, consumer, or lifestyle visuals -- the register is professional and recruiter-facing."
- "Do NOT use animated text effects that distract from the content -- transitions should support the message, not call attention to themselves."
- "Do NOT crowd the screen -- one idea per visual beat, with breathing room between them."
- "Do NOT use stock footage of generic office scenes, handshakes, or people at computers."
- "Do NOT use music that competes with the content -- audio should support the message, not overpower it."
- "Do NOT use light or pastel color treatments -- the visual register should be dark and professional."
- "Do NOT include a photo placeholder or headshot prompt."
- "Do NOT run longer than 60 seconds."
- "Do NOT use the words 'passionate,' 'journey,' or 'innovative.'"

---

### Prompt Labeling

Label each prompt clearly:

```
NARRATIVE PERSPECTIVE A -- [perspective name]
Deep Dive: [Prompt Name]
Brief: [Prompt Name]
Infographic: [Prompt Name]
Short Video: [Prompt Name]
```

```
NARRATIVE PERSPECTIVE B -- [perspective name]
Deep Dive: [Prompt Name]
Brief: [Prompt Name]
Infographic: [Prompt Name]
Short Video: [Prompt Name]
```

---

## Output File Format

The output file is saved as `[slug]-asset-package.md`. Example: `jordan-mills-asset-package.md`

The file opens with a header block:

```
# RoleBoost -- Candidate Asset Package
Candidate: [Full Name]
Slug: [slug]
Date: [date]
Story type: [selected story type]
Recommended perspective: [A or B]
Package tier: [leave blank -- superadmin fills in based on Fiverr order]
```

Then Section 1 (Narrative Guide Block) followed by Section 2 (Personalized NotebookLM Prompts).

---

## Quality Standards

Claude must meet these standards before delivering the output:

- Every claim in the narrative and hard question answer is supported by something in the uploaded material. No invented details, no assumed metrics, no plausible-sounding additions.
- The AI Mirror read is stated plainly in two tiers -- document read and market read -- one paragraph each. It is for the superadmin only and does not appear in the candidate asset package.
- Every asset is positive, evidence-based, and built to sell. The AI Mirror informs the narrative privately. Nothing from the Mirror appears in any asset as a weakness, objection, or negative framing.
- Gaps identified in the Mirror are coaching notes for the superadmin. They are never surfaced in assets. Gaps either get filled with evidence or they are not addressed at all.
- The hook is specific. "Strong results across a 12-year career" is not a hook. "Zero OSHA recordables across 12 years including night shift lead on active rail infrastructure" is a hook.
- The hard question answer does not hedge or apologize. It addresses the objection directly and ends with the evidence.
- The NotebookLM prompts are fully written and candidate-specific. A prompt that still contains "[candidate name]" is not finished.
- Every audio prompt opens with "This is a Boost on [candidate full name]." No other opening is acceptable.
- Every audio prompt ends with an explicit closing pitch instruction followed by the Do NOT lines.
- Every infographic prompt includes a design intent statement and explicit whitespace requirements.
- Every Short Video prompt includes an anchor statement, a four-beat visual sequence, an explicit closing pitch with candidate name, target role, and "Learn more about [candidate first name] at roleboost.app" as the final frame, and the full Do NOT list.
- No em dashes anywhere in the output. Use commas, semicolons, or periods instead.

---

## Future State -- Superadmin Dashboard Integration

This skill is designed to run in Claude chat today and plug into the superadmin dashboard when that is built. The dashboard version will:

- Accept resume upload and optional URL list via form inputs
- Trigger this workflow automatically on submission
- Store the output `.md` file in the candidate's asset locker (roleboost.app/storage/[slug])
- Display the two narrative perspectives for superadmin review and selection before asset production begins
- Track which NotebookLM prompts were run and which assets were delivered per package tier

Until the dashboard is built, all steps above are handled manually in Claude chat and the output file is delivered to the candidate via their asset locker link once that system is built.

---

## Related Files

| File | Purpose |
|---|---|
| `PERSONA_NARRATIVE_GUIDE.md` | Master reference for all 8 example personas -- same format as Section 1 output |
| `RoleBoost_NotebookLM_Prompt_Library.md` | Full prompt library v1.1 -- source for all prompts in Section 2 output |
| `EXAMPLE_PROFILES_CONTENT.md` | Original 5 persona content specs |
| `EXAMPLE_PROFILES_CONTENT_v2_additions.md` | Personas 6-8 content specs |
| `CLAUDE.md` | Project-wide Claude Code instructions |

---

*RoleBoost Candidate Asset Production Skill v1.6 -- roleboost.app -- Built by Rob Ramos*
