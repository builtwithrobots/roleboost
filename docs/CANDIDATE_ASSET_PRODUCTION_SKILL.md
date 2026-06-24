# RoleBoost -- Candidate Asset Production Skill
**Version 1.1 | June 2026 | Rob Ramos, Founder**
**File:** `CANDIDATE_ASSET_PRODUCTION_SKILL.md`
**Location:** RoleBoost project root alongside `CLAUDE.md`

---

## What This Skill Does

This skill runs the RoleBoost candidate asset production workflow. It is designed for superadmin use -- either directly in Claude chat today, or triggered from the superadmin dashboard once that is built.

Given a candidate's resume and any available supporting context, this skill:

1. Reads and analyzes all uploaded material
2. Applies the AI Mirror -- an honest, non-biased read of what the evidence actually shows
3. Determines the candidate's story type and narrative angle (two versions)
4. Produces a complete candidate asset package in one pass:
   - Narrative Guide Block (6 sections, matches `PERSONA_NARRATIVE_GUIDE.md` format)
   - Two personalized NotebookLM prompt sets -- one per narrative angle, fully written and ready to copy-paste into NotebookLM

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

Claude performs an honest, evidence-based read of the candidate. This is not a summary of the resume. It is an assessment of what the documented evidence actually shows -- independent of how the candidate perceives or describes themselves.

Claude evaluates:

- **What the resume actually demonstrates** vs. what it implies or claims without evidence
- **Career trajectory** -- is there clear upward movement, a plateau, a pivot, a gap, a rebuild?
- **Quantified vs. unquantified results** -- which claims have numbers behind them and which do not
- **Title vs. scope** -- is the candidate operating above, at, or below their stated title level?
- **The biggest gap between self-perception and documented evidence** -- where is the candidate likely underselling or overselling based on what is on paper?
- **The single most credible and compelling fact** in the entire file -- the one thing that is undeniable

Claude states this read plainly in a short paragraph before proceeding. This is the AI Mirror output.

### Step 3 -- Determine Story Type and Two Narrative Angles

Based on the AI Mirror read, Claude selects the candidate's primary story type from the list below. It then defines two distinct narrative angles -- not two tones of the same story, but two genuinely different framings that a candidate could choose between.

**Story types:**

| Type | When to use |
|---|---|
| The Career Arc | Strong linear progression with measurable results at each stage |
| The Builder | Has built operations, teams, or systems from scratch multiple times |
| The Problem Solver | Pattern of fixing broken things and turning around underperforming situations |
| The Leadership Story | Senior candidate -- results and people development both need to be present |
| The Skeptic and the Champion | Non-linear path, gap, pivot, layoff, or any element that needs contextualizing |
| The Specialist | Deep domain expertise in a specific niche -- breadth is not the story, depth is |

Claude states:
- Which story type it selected and why (2-3 sentences)
- Narrative Angle A -- what this framing leads with and why
- Narrative Angle B -- what this framing leads with and why
- Which angle it recommends and why

### Step 4 -- Produce the Candidate Asset Package

Claude produces the full output as a single `.md` document with two sections.

---

#### SECTION 1 -- NARRATIVE GUIDE BLOCK

Follows the exact format used in `PERSONA_NARRATIVE_GUIDE.md`. Six subsections:

**1. Identity Snapshot**
Name, slug (firstname-lastname, lowercase, hyphenated), public URL (getroleboost.com/c/[slug]), location, target role, headline, avatar color (assign from RoleBoost palette below), initials.

RoleBoost avatar color palette:
- Teal: #0F6E56
- Coral: #993C1D
- Amber: #B45309
- Blue: #185FA5
- Purple: #534AB7
- Forest green: #1A5C38
- Warm rose: #A0394A
- Slate blue: #2C4A7C
- Deep navy: #1E3A5F
- Charcoal: #2D2D2D

Assign the color that fits the candidate's industry and tone. Operations/trades: forest green or coral. Healthcare: amber. Tech: blue or slate blue. Executive: navy or purple. Retail/service: warm rose or teal.

**2. The Narrative**
2-3 sentences. This is the human story, not a resume summary. It must answer: what does this person's career actually show, what can their resume not say about them, and what does RoleBoost specifically do for this person that no other tool could. Write from the AI Mirror read -- grounded in evidence, free of inflation.

**3. The Hook**
One line only. The single most credible and compelling fact in the file. The thing that makes a recruiter stop. Must be specific -- a number, a moment, a result. No generalities.

**4. The Hard Question**
The one question every recruiter will ask and the AI chatbot must handle perfectly. State the question, then write a tight, specific answer (5-8 sentences). The answer must use only evidence from the file -- no claims without support. The answer should be direct, confident, and end with a pivot to what the candidate brings.

**5. Key Numbers**
A bulleted list of 5-8 metrics and specifics that must appear in every asset -- audio, infographic, chatbot, everything. These are the facts that cannot be wrong or missing. Include: career span, scale metrics (team size, revenue, volume, portfolio size), the most impressive quantified result, any certifications or credentials worth noting, and anything that directly addresses the likely hard question.

**6. NotebookLM Prompt Mapping**
A table showing which prompts from the RoleBoost NotebookLM Elite Prompt Library fit this candidate, with a one-line rationale and a tone note for each. Separate rows for Deep Dive, Brief, and Infographic.

---

#### SECTION 2 -- PERSONALIZED NOTEBOOKLM PROMPTS

Two complete prompt sets -- one for Narrative Angle A, one for Narrative Angle B. Each set contains three prompts: one Deep Dive, one Brief, one Infographic. All prompts are fully written out with the candidate's name, specialty, and relevant specifics already filled in. They are ready to copy and paste directly into NotebookLM with no editing required.

Each prompt follows the v1.1 format from `RoleBoost_NotebookLM_Prompt_Library.md`. Audio prompts (Deep Dive and Brief) use this structure:

**Audio prompt format (tested and confirmed working):**
- First line: "You are a single host." -- this tells NotebookLM to use one voice, not two
- Second line: "Your literal first words are: 'This is a Boost on [candidate full name].' Say that line out loud before anything else. Then go directly into the content with no additional intro phrase." -- this produces the correct spoken opening
- Prompt body follows immediately with candidate-specific content woven in
- Ends with Do NOT instructions (what to avoid, length limits, tone guardrails)

Every audio prompt must include this Do NOT line in its closing instructions: "Do NOT use casual or informal language, analogies, or editorial commentary -- the tone is confident and professional throughout, like a trusted colleague briefing a hiring manager, not a podcast host." NotebookLM defaults to a casual podcast tone without this constraint; it produces analogies, filler phrases, and informal asides that undermine the credibility of the asset.

**Infographic prompt format:**
- Opens with a one-line framing that describes the candidate and their story angle
- Prompt body specifies layout, hero stats, color scheme, and visual hierarchy with candidate-specific details woven in
- Ends with Do NOT instructions

All prompts must have candidate's name, specific stats, and relevant details already filled in. No placeholders. A prompt that still contains "[candidate name]" is not finished.

Label each prompt clearly:

```
NARRATIVE ANGLE A -- [angle name]
Deep Dive: [Prompt Name]
Brief: [Prompt Name]
Infographic: [Prompt Name]
```

```
NARRATIVE ANGLE B -- [angle name]
Deep Dive: [Prompt Name]
Brief: [Prompt Name]
Infographic: [Prompt Name]
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
Recommended angle: [A or B]
Package tier: [leave blank -- superadmin fills in based on Fiverr order]
```

Then Section 1 (Narrative Guide Block) followed by Section 2 (Personalized NotebookLM Prompts).

---

## Quality Standards

Claude must meet these standards before delivering the output:

- Every claim in the narrative and hard question answer is supported by something in the uploaded material. No invented details, no assumed metrics, no plausible-sounding additions.
- The AI Mirror read is stated plainly, even if it is unflattering. If the resume is thin, say so and explain what the AI can do with what is there. If the candidate's self-description is inflated relative to the evidence, note the gap.
- The hook is specific. "Strong results across a 12-year career" is not a hook. "Zero OSHA recordables across 12 years including night shift lead on active rail infrastructure" is a hook.
- The hard question answer does not hedge or apologize. It addresses the objection directly and ends with the evidence.
- The NotebookLM prompts are fully written and candidate-specific. A prompt that still contains "[candidate name]" as a placeholder is not finished.
- No em dashes anywhere in the output. Use commas, semicolons, or periods instead.

---

## Future State -- Superadmin Dashboard Integration

This skill is designed to run in Claude chat today and plug into the superadmin dashboard when that is built. The dashboard version will:

- Accept resume upload and optional URL list via form inputs
- Trigger this workflow automatically on submission
- Store the output `.md` file in the candidate's asset locker (getroleboost.com/storage/[slug])
- Display the two narrative angles for superadmin review and selection before asset production begins
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

*RoleBoost Candidate Asset Production Skill v1.1 -- getroleboost.com -- Built by Rob Ramos*
