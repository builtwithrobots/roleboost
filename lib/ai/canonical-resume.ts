import { z } from 'zod';

// The canonical, structured representation of a résumé. Single source of truth
// reused by the parser (lib/ai/parse-resume.ts), the .docx/.pdf renderers
// (lib/resume/*), and the profile-field derivation (lib/ai/derive-profile.ts).
//
// Keep this flat and constraint-light: it doubles as the tool input_schema sent
// to Claude, and we re-validate the model's output with the Zod schema below.

export const ContactSchema = z.object({
  full_name: z.string(),
  email: z.string().nullish(),
  phone: z.string().nullish(),
  location: z.string().nullish(),
  linkedin_url: z.string().nullish(),
  website: z.string().nullish(),
});

export const ExperienceSchema = z.object({
  company: z.string(),
  title: z.string(),
  location: z.string().nullish(),
  start_date: z.string().nullish(),
  end_date: z.string().nullish(),
  highlights: z.array(z.string()).default([]),
});

export const EducationSchema = z.object({
  institution: z.string(),
  degree: z.string().nullish(),
  field: z.string().nullish(),
  start_date: z.string().nullish(),
  end_date: z.string().nullish(),
});

export const CertificationSchema = z.object({
  name: z.string(),
  issuer: z.string().nullish(),
  date: z.string().nullish(),
});

export const CanonicalResumeSchema = z.object({
  contact: ContactSchema,
  headline: z.string().nullish(),
  summary: z.string().nullish(),
  experience: z.array(ExperienceSchema).default([]),
  education: z.array(EducationSchema).default([]),
  skills: z.array(z.string()).default([]),
  certifications: z.array(CertificationSchema).default([]),
});

export type CanonicalResume = z.infer<typeof CanonicalResumeSchema>;

// JSON Schema handed to Claude as the `submit_resume` tool's input_schema.
// Mirrors the Zod shape above; the Zod schema re-validates the returned input.
export const CANONICAL_RESUME_JSON_SCHEMA = {
  type: 'object',
  properties: {
    contact: {
      type: 'object',
      properties: {
        full_name: { type: 'string', description: 'Candidate full name' },
        email: { type: 'string' },
        phone: { type: 'string' },
        location: { type: 'string', description: 'City, State / Country' },
        linkedin_url: { type: 'string' },
        website: { type: 'string' },
      },
      required: ['full_name'],
    },
    headline: { type: 'string', description: 'One-line professional headline' },
    summary: { type: 'string', description: 'Professional summary paragraph' },
    experience: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          company: { type: 'string' },
          title: { type: 'string' },
          location: { type: 'string' },
          start_date: { type: 'string', description: 'e.g. "Jan 2021"' },
          end_date: { type: 'string', description: 'e.g. "Present"' },
          highlights: {
            type: 'array',
            items: { type: 'string' },
            description: 'Accomplishment bullets, ideally quantified',
          },
        },
        required: ['company', 'title'],
      },
    },
    education: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          institution: { type: 'string' },
          degree: { type: 'string' },
          field: { type: 'string' },
          start_date: { type: 'string' },
          end_date: { type: 'string' },
        },
        required: ['institution'],
      },
    },
    skills: { type: 'array', items: { type: 'string' } },
    certifications: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          issuer: { type: 'string' },
          date: { type: 'string' },
        },
        required: ['name'],
      },
    },
  },
  required: ['contact'],
} as const;

// Deterministic Markdown rendering of the canonical résumé. This is the editable
// source of truth shown to the candidate; editing + saving it re-generates the
// .docx/.pdf in Phase 1.
export function canonicalResumeToMarkdown(resume: CanonicalResume): string {
  const lines: string[] = [];
  const c = resume.contact;

  lines.push(`# ${c.full_name}`);
  if (resume.headline) lines.push(`\n_${resume.headline}_`);

  const contactBits = [c.email, c.phone, c.location, c.linkedin_url, c.website].filter(Boolean);
  if (contactBits.length) lines.push(`\n${contactBits.join(' · ')}`);

  if (resume.summary) {
    lines.push('\n## Summary', '', resume.summary);
  }

  if (resume.experience.length) {
    lines.push('\n## Experience');
    for (const e of resume.experience) {
      const dates = [e.start_date, e.end_date].filter(Boolean).join(' – ');
      const heading = [e.title, e.company].filter(Boolean).join(', ');
      lines.push(`\n### ${heading}`);
      const meta = [e.location, dates].filter(Boolean).join(' · ');
      if (meta) lines.push(`_${meta}_`);
      for (const h of e.highlights) lines.push(`- ${h}`);
    }
  }

  if (resume.education.length) {
    lines.push('\n## Education');
    for (const ed of resume.education) {
      const degree = [ed.degree, ed.field].filter(Boolean).join(', ');
      const dates = [ed.start_date, ed.end_date].filter(Boolean).join(' – ');
      lines.push(`\n### ${ed.institution}`);
      const meta = [degree, dates].filter(Boolean).join(' · ');
      if (meta) lines.push(`_${meta}_`);
    }
  }

  if (resume.skills.length) {
    lines.push('\n## Skills', '', resume.skills.join(', '));
  }

  if (resume.certifications.length) {
    lines.push('\n## Certifications');
    for (const cert of resume.certifications) {
      const meta = [cert.issuer, cert.date].filter(Boolean).join(' · ');
      lines.push(`- ${cert.name}${meta ? ` (${meta})` : ''}`);
    }
  }

  return lines.join('\n').trim() + '\n';
}
