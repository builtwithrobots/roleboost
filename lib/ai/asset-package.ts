import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import { anthropic } from './client';
import { GENERATION_MODEL } from './models';
import {
  ASSET_PACKAGE_STORY_TYPE_LABELS,
  type AssetPackage,
  type AssetPackageIdentity,
  type AssetPackagePerspective,
  type AssetPackagePromptMappingRow,
  type AssetPackageStoryType,
  type IntakeDocument,
} from '@/lib/types';

// Runs the RoleBoost Candidate Asset Production Skill in full (Section 1 Narrative
// Guide Block + Section 2 NotebookLM prompts), strategized toward a target role +
// optional job description. Produces TWO narrative perspectives, each a
// self-contained narrative plus its four ready-to-run NotebookLM prompts (Deep
// Dive, Brief, Infographic, Short Video). This powers the SUPERADMIN production
// tool (/admin/asset-packages): the founder generates and delivers the .md as a
// paid service; the candidate drops it into their assets area themselves.
//
// Generation is STAGED for quality: Phase 1 produces the strategy + both
// perspectives' Section 1; Phase 2 writes the four long prompt bodies per
// perspective (two calls in parallel). One-shot generation would truncate the
// prompt bodies.

const STORY_TYPES = Object.keys(ASSET_PACKAGE_STORY_TYPE_LABELS) as AssetPackageStoryType[];

// The RoleBoost avatar palette (skill v1.7). Returned hex is validated against this.
const PALETTE: { name: string; hex: string }[] = [
  { name: 'Teal', hex: '#0F6E56' },
  { name: 'Coral', hex: '#993C1D' },
  { name: 'Amber', hex: '#B45309' },
  { name: 'Blue', hex: '#185FA5' },
  { name: 'Purple', hex: '#534AB7' },
  { name: 'Forest Green', hex: '#1A5C38' },
  { name: 'Warm Rose', hex: '#A0394A' },
  { name: 'Slate Blue', hex: '#2C4A7C' },
  { name: 'Deep Navy', hex: '#1E3A5F' },
  { name: 'Charcoal', hex: '#2D2D2D' },
  { name: 'Crimson', hex: '#8B1A2B' },
  { name: 'Sienna', hex: '#7D4E2D' },
  { name: 'Sage', hex: '#4A7C59' },
  { name: 'Steel Blue', hex: '#3A5F7D' },
  { name: 'Plum', hex: '#6B3A6B' },
  { name: 'Warm Taupe', hex: '#7A6A58' },
];
const DEFAULT_COLOR = { name: 'Slate Blue', hex: '#2C4A7C' };

const PROMPT_FORMATS = ['Deep Dive', 'Brief', 'Infographic', 'Short Video'] as const;

function tool(name: string, schema: object): Anthropic.Messages.Tool {
  return {
    name,
    description: 'Submit the structured result.',
    input_schema: schema as unknown as Anthropic.Messages.Tool.InputSchema,
  };
}

function firstToolInput<T>(response: Anthropic.Messages.Message): T {
  const block = response.content.find((b) => b.type === 'tool_use');
  if (!block || block.type !== 'tool_use') {
    throw new Error('Asset-package model did not return structured output');
  }
  return block.input as T;
}

function formatDocs(docs: IntakeDocument[]): string {
  return docs
    .filter((d) => d.text.trim())
    .map((d) => `### SOURCE: ${d.label}\n${d.text.trim()}`)
    .join('\n\n');
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
  return (first + last).toUpperCase();
}

// ── Phase 1: strategy + both perspectives' Section 1 ──────────────────────────

const PERSPECTIVE_SECTION1_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Short label for this framing, e.g. "The Trust Signal".' },
    summary: {
      type: 'string',
      description: 'One or two sentences on what this framing leads with and why.',
    },
    narrative: {
      type: 'string',
      description:
        '2-3 sentences, third person about the candidate. The human story grounded in evidence, not a résumé summary.',
    },
    hook: {
      type: 'string',
      description: 'One line. The single most credible, specific fact: a number, a moment, a result. Never a generality.',
    },
    hard_question: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'The one question every recruiter will ask.' },
        answer: {
          type: 'string',
          description:
            'A tight, specific FIRST-PERSON answer (5-8 sentences) using only evidence from the file. Direct and confident; no hedging or apology; ends on what the candidate brings.',
        },
      },
      required: ['question', 'answer'],
      additionalProperties: false,
    },
    key_numbers: {
      type: 'array',
      items: { type: 'string' },
      description: '5-8 specific metrics and facts that must appear in every asset (scale, results, span, credentials).',
    },
    prompt_mapping: {
      type: 'array',
      description: 'Exactly 4 rows: one each for Deep Dive, Brief, Infographic, Short Video.',
      items: {
        type: 'object',
        properties: {
          format: { type: 'string', enum: [...PROMPT_FORMATS] },
          prompt_name: { type: 'string', description: 'The name of this prompt, e.g. "The First Non-Lead".' },
          rationale: { type: 'string', description: 'One line: why this format fits this candidate.' },
          tone_note: { type: 'string', description: 'One line: the tone this asset should carry.' },
        },
        required: ['format', 'prompt_name', 'rationale', 'tone_note'],
        additionalProperties: false,
      },
    },
  },
  required: ['name', 'summary', 'narrative', 'hook', 'hard_question', 'key_numbers', 'prompt_mapping'],
  additionalProperties: false,
};

const PHASE1_SCHEMA = {
  type: 'object',
  properties: {
    story_type: { type: 'string', enum: [...STORY_TYPES] },
    identity: {
      type: 'object',
      properties: {
        headline: { type: 'string', description: 'One-line professional headline for the candidate.' },
        location: { type: 'string', description: 'Location, or empty string if unknown.' },
        target_role: { type: 'string', description: 'The role this package targets.' },
        avatar_color_name: {
          type: 'string',
          description:
            'The avatar color NAME chosen from the RoleBoost palette using the two-axis pairing guide (industry x tone).',
        },
        avatar_color_hex: { type: 'string', description: 'The exact hex for the chosen palette color.' },
        avatar_color_rationale: {
          type: 'string',
          description: 'One sentence explaining the color choice (industry + tone read).',
        },
      },
      required: ['headline', 'location', 'target_role', 'avatar_color_name', 'avatar_color_hex', 'avatar_color_rationale'],
      additionalProperties: false,
    },
    recommended: { type: 'string', enum: ['A', 'B'], description: 'Which perspective is the stronger lead.' },
    perspective_a: PERSPECTIVE_SECTION1_SCHEMA,
    perspective_b: PERSPECTIVE_SECTION1_SCHEMA,
  },
  required: ['story_type', 'identity', 'recommended', 'perspective_a', 'perspective_b'],
  additionalProperties: false,
};

const PHASE1_SYSTEM = `You are running the RoleBoost Candidate Asset Production Skill. You are given a candidate's résumé and any supporting career sources about the same person, plus the role they are targeting and (optionally) a job description they are strategizing for. Produce the strategic foundation of their asset package: the story type, the identity snapshot, and TWO distinct narrative perspectives, each with its own Section 1 narrative guide.

Workflow:
1. Read everything in full.
2. Apply the AI Mirror privately: an honest, evidence-based read of what the documents actually show (trajectory, quantified vs unquantified results, title vs scope, the single most credible fact, and how the candidate is positioned for the TARGET ROLE). This informs the work; it never appears in any output.
3. Select the candidate's story type from the list below.
4. Define TWO genuinely different narrative perspectives, not two tones of one story. Each perspective is a full, self-contained narrative the candidate could choose to lead with.
5. Recommend the stronger perspective.
6. Strategize toward the target role and job description: choose the framing, hook, hard question, and proof points that make the strongest case for THIS job.

Story types (pick the single best fit):
- The Career Arc: strong linear progression with measurable results at each stage.
- The Builder: has built operations, teams, or systems from scratch multiple times.
- The Problem Solver: a pattern of fixing broken things and turning around underperforming situations.
- The Leadership Story: senior candidate, results and people development both present and balanced.
- The Skeptic and the Champion: non-linear path, gap, pivot, or layoff that needs contextualizing.
- The Specialist: deep domain expertise in a niche; depth is the story, not breadth.
- The Promoter: career measured in commercial terms (quota, pipeline, revenue, accounts, market share).
- The Reinventor: a deliberate, completed industry or function pivot with a real new track record.
- The Culture Builder: the most compelling proof is human (teams built and retained, culture, engagement).
- The Steady Hand: sustained, consistent, high-stakes performance over a long period at scale.

Avatar color: choose ONE from the RoleBoost palette using two axes, the candidate's industry/function (from the target role) and their dominant tone (from the Mirror read). Return the name, its exact hex, and a one-sentence rationale.
Palette (name : hex): Teal #0F6E56, Coral #993C1D, Amber #B45309, Blue #185FA5, Purple #534AB7, Forest Green #1A5C38, Warm Rose #A0394A, Slate Blue #2C4A7C, Deep Navy #1E3A5F, Charcoal #2D2D2D, Crimson #8B1A2B, Sienna #7D4E2D, Sage #4A7C59, Steel Blue #3A5F7D, Plum #6B3A6B, Warm Taupe #7A6A58.
Tone axes: Authoritative and proven; Energetic and growth-oriented; Warm and people-first; Precise and data-driven. If the tone is a blend, pick the axis the candidate's strongest proof points support, not the one their title implies.

For EACH perspective produce: a name, a one/two-sentence summary of what it leads with, a 2-3 sentence narrative, a one-line hook, the one hard question every recruiter will ask with a tight first-person answer, 5-8 key numbers, and a 4-row NotebookLM prompt mapping (one row each for Deep Dive, Brief, Infographic, Short Video) with a prompt name, a one-line rationale, and a one-line tone note.

Hard rules:
- Every claim must be supported by the provided material. Never invent a number, metric, date, credential, or outcome. If the file is thin, work honestly with what is there.
- The hook must be specific, a number, a moment, a result, never a generality like "strong results across a long career".
- Write each narrative in third person about the candidate. Write each hard-question answer in first person ("I ...").
- The hard-question answer is direct and confident, does not hedge or apologize, and ends on what the candidate brings.
- This is the candidate's hype man: positive, evidence-based, built to sell. No weaknesses, objections, or speculation appear in any output.
- Never use em dashes anywhere in the output. Use commas, semicolons, or periods instead.

Submit via the submit_strategy tool.`;

// ── Phase 2: the four NotebookLM prompts for one perspective ──────────────────

const PROMPT_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'This prompt\'s short name, e.g. "The First Non-Lead".' },
    body: { type: 'string', description: 'The full, copy-paste-ready prompt body, following the format spec exactly.' },
  },
  required: ['title', 'body'],
  additionalProperties: false,
};

const PHASE2_SCHEMA = {
  type: 'object',
  properties: {
    deep_dive: PROMPT_SCHEMA,
    brief: PROMPT_SCHEMA,
    infographic: PROMPT_SCHEMA,
    short_video: PROMPT_SCHEMA,
  },
  required: ['deep_dive', 'brief', 'infographic', 'short_video'],
  additionalProperties: false,
};

const PHASE2_SYSTEM = `You are writing the four NotebookLM prompts (Section 2) for ONE narrative perspective of a RoleBoost candidate asset package. You are given the candidate's full name, the target role, the job description (optional), and this perspective's Section 1 narrative guide (narrative, hook, hard question, key numbers). Write all four prompts fully, candidate-specific, ready to copy and paste into NotebookLM with no editing. Strategize the emphasis toward the target role and job description.

Produce exactly four prompts: a Deep Dive (audio), a Brief (audio), an Infographic, and a Short Video.

AUDIO PROMPTS (Deep Dive and Brief) must follow this structure exactly:
- Line 1 (role establishment), verbatim: "The hosts are speaking directly to a hiring manager. Hosts are energetic, intelligent and engaging with a smooth cadence and transitions."
- Line 2 (opening instruction): 'Your literal first words are: "This is a Boost on [candidate full name]." Say that exact line out loud before anything else. Then go directly into the content with no additional intro phrase. Do not use the word "Brief" or reference this as a brief at any point.'
- Body: candidate-specific content, written as direct address to one hiring manager.
- A closing pitch instruction, in this required sequence: name the specific situation where this candidate is the right hire; state plainly they are the person to onboard; deliver 3-4 top proof facts in rapid sequence; close with "Learn more about [candidate first name] at roleboost.app."; then add "Do not soften this. Do not add qualifiers. The pitch is the last thing the hiring manager hears."
- End with these three Do NOT lines exactly:
  "Do NOT begin with 'This is a Brief,' 'This is a Deep Dive,' or any other format label. The only permitted opening is 'This is a Boost on [candidate full name].'"
  "Do NOT use casual or informal language, analogies, or editorial commentary, the tone is confident and direct, like a trusted colleague briefing a hiring manager, not a podcast host."
  "Do NOT use the words 'passionate,' 'journey,' or 'innovative.'"
- Deep Dive: do not exceed 4 minutes; open with the hook fact, build the case, address the likely hard question, narrative close, then the pitch.
- Brief: do not exceed 90 seconds; hook stat, two proof points, pitch. Open the pitch with "End with a direct closing pitch, spoken in this exact sequence:".

INFOGRAPHIC PROMPT must include: an opening framing line (candidate, story perspective, the one anchoring fact); a design intent statement (how it should feel); three sections with explicit generous whitespace between them; clean minimal icons (Google-style acceptable, one per stat maximum, functional not decorative); dark professional background; clean readable authoritative fonts; a typography hierarchy by role (hero stat, section label, body); no more than three accent colors with the primary accent named on one element. Close with these Do NOT lines: no light or pastel colors; no more than three accent colors; no decorative dividers/textures/ornaments; no photo placeholder; do not crowd sections (whitespace is part of the design); no decorative or display fonts.

SHORT VIDEO PROMPT (NotebookLM Custom Topic field, Short format) must include: an anchor statement (candidate, story perspective, the single fact the video delivers); a four-beat visual sequence in order (hook stat, first proof point, second proof point, closing frame); a closing pitch opened with "End with a direct closing pitch in this exact sequence:" naming the situation, 2-3 rapid proof facts, and a final frame with full name, target role, and "Learn more about [candidate first name] at roleboost.app", then "Do not soften this. The closing frame is the last thing the hiring manager sees." Close with the full Do NOT list: no casual/consumer/lifestyle visuals; no distracting animated text; do not crowd the screen; no generic office/handshake stock footage; no competing music; no light/pastel treatments; no photo placeholder; do not run longer than 60 seconds; do not use "passionate," "journey," or "innovative."

Global rules:
- Every claim must trace to the supplied Section 1 / résumé material. Never invent facts.
- Fill in every placeholder with the real candidate specifics. A prompt that still contains "[candidate name]" is not finished. (The bracketed tokens above are instructions to you, not literal text to leave in.)
- Never use em dashes anywhere in the output. Use commas, semicolons, or periods instead.

Submit via the submit_prompts tool.`;

// ── Helpers to clean model output ─────────────────────────────────────────────

interface RawPerspectiveS1 {
  name?: string;
  summary?: string;
  narrative?: string;
  hook?: string;
  hard_question?: { question?: string; answer?: string };
  key_numbers?: unknown;
  prompt_mapping?: unknown;
}

function cleanPromptMapping(raw: unknown): AssetPackagePromptMappingRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      const row = r as Partial<AssetPackagePromptMappingRow>;
      const format = (PROMPT_FORMATS as readonly string[]).includes(row.format as string)
        ? (row.format as AssetPackagePromptMappingRow['format'])
        : 'Deep Dive';
      return {
        format,
        prompt_name: String(row.prompt_name ?? '').trim(),
        rationale: String(row.rationale ?? '').trim(),
        tone_note: String(row.tone_note ?? '').trim(),
      };
    })
    .filter((r) => r.prompt_name.length > 0);
}

function cleanKeyNumbers(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((n) => String(n).trim()).filter(Boolean);
}

// ── Rendering ─────────────────────────────────────────────────────────────────

/** Section 1 rendered as the brain context document (promotes to context_package_md). */
export function renderBrainContextMarkdown(
  p: AssetPackagePerspective,
  identity: AssetPackageIdentity,
  storyType: AssetPackageStoryType,
  fullName: string,
): string {
  const identityLines = [
    identity.target_role && `- **Target role:** ${identity.target_role}`,
    identity.location && `- **Location:** ${identity.location}`,
    identity.headline && `- **Headline:** ${identity.headline}`,
  ].filter(Boolean);

  const lines = [
    `# ${fullName}: Career Context Document`,
    `**Story type:** ${ASSET_PACKAGE_STORY_TYPE_LABELS[storyType]}  ·  **Perspective:** ${p.name}`,
    '',
    '## Identity',
    ...identityLines,
    '',
    '## The Narrative',
    p.narrative,
    '',
    '## The Hook',
    p.hook,
    '',
    '## The Hard Question',
    `**${p.hard_question.question}**`,
    '',
    p.hard_question.answer,
    '',
    '## Key Numbers',
    ...p.key_numbers.map((n) => `- ${n}`),
    '',
  ];
  return lines.join('\n');
}

function renderPerspectiveSection2(p: AssetPackagePerspective, key: string): string {
  const block = (label: string, title: string, body: string) =>
    [`### ${label}: ${title}`, '', body, ''].join('\n');
  return [
    `## NARRATIVE PERSPECTIVE ${key} -- ${p.name}`,
    '',
    `*${p.summary}*`,
    '',
    '---',
    '',
    block('Deep Dive', p.prompts.deep_dive.title, p.prompts.deep_dive.body),
    '---',
    '',
    block('Brief', p.prompts.brief.title, p.prompts.brief.body),
    '---',
    '',
    block('Infographic', p.prompts.infographic.title, p.prompts.infographic.body),
    '---',
    '',
    block('Short Video', p.prompts.short_video.title, p.prompts.short_video.body),
  ].join('\n');
}

/** The full downloadable deliverable, in the Candidate Asset Package file layout. */
export function renderAssetPackageMarkdown(
  pkg: Omit<AssetPackage, 'full_markdown'>,
  fullName: string,
  date: string,
): string {
  const lead = pkg.perspectives[pkg.recommended];
  const id = pkg.identity;

  const header = [
    '# RoleBoost -- Candidate Asset Package',
    `Candidate: ${fullName}`,
    `Slug: ${id.slug}`,
    `Date: ${date}`,
    `Story type: ${ASSET_PACKAGE_STORY_TYPE_LABELS[pkg.story_type]}`,
    `Recommended perspective: ${pkg.recommended}`,
    'Package tier:',
    '',
    '---',
    '',
  ];

  const section1 = [
    '# SECTION 1 -- NARRATIVE GUIDE BLOCK',
    '',
    '## 1. Identity Snapshot',
    '',
    `**Name:** ${id.name}`,
    `**Slug:** ${id.slug}`,
    `**Public URL:** roleboost.app/c/${id.slug}`,
    `**Location:** ${id.location}`,
    `**Target role:** ${id.target_role}`,
    `**Headline:** ${id.headline}`,
    `**Avatar color:** ${id.avatar_color.name} (${id.avatar_color.hex}) -- ${id.avatar_color.rationale}`,
    `**Initials:** ${id.initials}`,
    '',
    '---',
    '',
    '## 2. The Narrative',
    '',
    lead.narrative,
    '',
    '## 3. The Hook',
    '',
    lead.hook,
    '',
    '## 4. The Hard Question',
    '',
    `**${lead.hard_question.question}**`,
    '',
    lead.hard_question.answer,
    '',
    '## 5. Key Numbers',
    '',
    ...lead.key_numbers.map((n) => `- ${n}`),
    '',
    '## 6. NotebookLM Prompt Mapping',
    '',
    '| Format | Prompt name | Rationale | Tone note |',
    '|---|---|---|---|',
    ...lead.prompt_mapping.map(
      (r) => `| ${r.format} | ${r.prompt_name} | ${r.rationale} | ${r.tone_note} |`,
    ),
    '',
    '---',
    '',
  ];

  const section2 = [
    '# SECTION 2 -- PERSONALIZED NOTEBOOKLM PROMPTS',
    '',
    '---',
    '',
    renderPerspectiveSection2(pkg.perspectives.A, 'A'),
    '',
    '---',
    '',
    renderPerspectiveSection2(pkg.perspectives.B, 'B'),
    '',
    '---',
    '',
    `*RoleBoost Candidate Asset Package -- ${id.slug} -- ${date} -- roleboost.app*`,
    '',
  ];

  return [...header, ...section1, ...section2].join('\n');
}

// ── Generation ────────────────────────────────────────────────────────────────

export interface GenerateAssetPackageInput {
  fullName: string;
  slug: string;
  resumeMarkdown: string | null;
  sources: IntakeDocument[];
  targetRole: string;
  jobDescription: string | null;
}

/**
 * Generates the full asset package (both perspectives, Section 1 + Section 2).
 * `chosen` starts null: the candidate picks a perspective downstream, which
 * promotes its Section 1 to the brain. Throws if a model call returns no
 * structured output.
 */
export async function generateAssetPackage(input: GenerateAssetPackageInput): Promise<AssetPackage> {
  const { fullName, slug, resumeMarkdown, sources, targetRole, jobDescription } = input;

  const sourceBlock = sources.filter((s) => s.text.trim()).length
    ? `\n\nSUPPORTING SOURCES:\n${formatDocs(sources)}`
    : '';
  const jdBlock = jobDescription?.trim()
    ? `\n\nTARGET JOB DESCRIPTION:\n${jobDescription.trim()}`
    : '\n\nTARGET JOB DESCRIPTION: None provided.';

  const phase1Content = `CANDIDATE: ${fullName}
TARGET ROLE: ${targetRole}${jdBlock}

RÉSUMÉ:
${resumeMarkdown ?? 'None provided.'}${sourceBlock}`;

  const phase1Res = await anthropic.messages.create({
    model: GENERATION_MODEL,
    max_tokens: 4000,
    system: PHASE1_SYSTEM,
    tools: [tool('submit_strategy', PHASE1_SCHEMA)],
    tool_choice: { type: 'tool', name: 'submit_strategy' },
    messages: [{ role: 'user', content: phase1Content }],
  });

  const raw = firstToolInput<{
    story_type: AssetPackageStoryType;
    identity: {
      headline?: string;
      location?: string;
      target_role?: string;
      avatar_color_name?: string;
      avatar_color_hex?: string;
      avatar_color_rationale?: string;
    };
    recommended: string;
    perspective_a: RawPerspectiveS1;
    perspective_b: RawPerspectiveS1;
  }>(phase1Res);

  const storyType: AssetPackageStoryType = STORY_TYPES.includes(raw.story_type)
    ? raw.story_type
    : 'career_arc';

  // Validate the avatar color against the palette (by name, then hex; else default).
  const rawName = (raw.identity?.avatar_color_name ?? '').trim();
  const rawHex = (raw.identity?.avatar_color_hex ?? '').trim().toUpperCase();
  const matched =
    PALETTE.find((c) => c.name.toLowerCase() === rawName.toLowerCase()) ??
    PALETTE.find((c) => c.hex.toUpperCase() === rawHex) ??
    DEFAULT_COLOR;

  const identity: AssetPackageIdentity = {
    name: fullName,
    slug,
    location: (raw.identity?.location ?? '').trim(),
    target_role: (raw.identity?.target_role ?? '').trim() || targetRole,
    headline: (raw.identity?.headline ?? '').trim(),
    avatar_color: {
      name: matched.name,
      hex: matched.hex,
      rationale: (raw.identity?.avatar_color_rationale ?? '').trim(),
    },
    initials: initialsFrom(fullName),
  };

  const recommended = raw.recommended === 'B' ? 'B' : 'A';

  // Phase 2: write the four prompts for each perspective, in parallel.
  const [promptsA, promptsB] = await Promise.all([
    generatePerspectivePrompts(fullName, targetRole, jobDescription, raw.perspective_a),
    generatePerspectivePrompts(fullName, targetRole, jobDescription, raw.perspective_b),
  ]);

  const perspectiveA = assemblePerspective(raw.perspective_a, promptsA, identity, storyType, fullName);
  const perspectiveB = assemblePerspective(raw.perspective_b, promptsB, identity, storyType, fullName);

  const generated_at = new Date().toISOString();
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const base: Omit<AssetPackage, 'full_markdown'> = {
    target_role: targetRole,
    job_description: jobDescription?.trim() ? jobDescription.trim() : null,
    story_type: storyType,
    recommended,
    chosen: null,
    identity,
    perspectives: { A: perspectiveA, B: perspectiveB },
    generated_at,
  };

  return { ...base, full_markdown: renderAssetPackageMarkdown(base, fullName, date) };
}

type PhasePrompts = {
  deep_dive: { title: string; body: string };
  brief: { title: string; body: string };
  infographic: { title: string; body: string };
  short_video: { title: string; body: string };
};

async function generatePerspectivePrompts(
  fullName: string,
  targetRole: string,
  jobDescription: string | null,
  s1: RawPerspectiveS1,
): Promise<PhasePrompts> {
  const jdBlock = jobDescription?.trim()
    ? `\nTARGET JOB DESCRIPTION:\n${jobDescription.trim()}\n`
    : '\nTARGET JOB DESCRIPTION: None provided.\n';

  const content = `CANDIDATE FULL NAME: ${fullName}
TARGET ROLE: ${targetRole}
${jdBlock}
PERSPECTIVE: ${(s1.name ?? '').trim()}
WHAT IT LEADS WITH: ${(s1.summary ?? '').trim()}

SECTION 1 NARRATIVE GUIDE FOR THIS PERSPECTIVE:
Narrative: ${(s1.narrative ?? '').trim()}
Hook: ${(s1.hook ?? '').trim()}
Hard question: ${(s1.hard_question?.question ?? '').trim()}
Hard answer: ${(s1.hard_question?.answer ?? '').trim()}
Key numbers:
${cleanKeyNumbers(s1.key_numbers).map((n) => `- ${n}`).join('\n')}`;

  const res = await anthropic.messages.create({
    model: GENERATION_MODEL,
    max_tokens: 4000,
    system: PHASE2_SYSTEM,
    tools: [tool('submit_prompts', PHASE2_SCHEMA)],
    tool_choice: { type: 'tool', name: 'submit_prompts' },
    messages: [{ role: 'user', content }],
  });

  return firstToolInput<PhasePrompts>(res);
}

function cleanPrompt(raw: { title?: string; body?: string } | undefined): { title: string; body: string } {
  return { title: String(raw?.title ?? '').trim(), body: String(raw?.body ?? '').trim() };
}

function assemblePerspective(
  s1: RawPerspectiveS1,
  prompts: PhasePrompts,
  identity: AssetPackageIdentity,
  storyType: AssetPackageStoryType,
  fullName: string,
): AssetPackagePerspective {
  const perspective: AssetPackagePerspective = {
    name: (s1.name ?? '').trim(),
    summary: (s1.summary ?? '').trim(),
    narrative: (s1.narrative ?? '').trim(),
    hook: (s1.hook ?? '').trim(),
    hard_question: {
      question: (s1.hard_question?.question ?? '').trim(),
      answer: (s1.hard_question?.answer ?? '').trim(),
    },
    key_numbers: cleanKeyNumbers(s1.key_numbers),
    prompt_mapping: cleanPromptMapping(s1.prompt_mapping),
    prompts: {
      deep_dive: cleanPrompt(prompts.deep_dive),
      brief: cleanPrompt(prompts.brief),
      infographic: cleanPrompt(prompts.infographic),
      short_video: cleanPrompt(prompts.short_video),
    },
    brain_context_md: '',
  };
  perspective.brain_context_md = renderBrainContextMarkdown(perspective, identity, storyType, fullName);
  return perspective;
}
