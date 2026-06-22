import 'server-only';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from 'docx';
import type { CanonicalResume } from '@/lib/ai/canonical-resume';

// Render the canonical résumé to a clean, ATS-readable .docx Buffer.
// Pure JS (no native deps) — safe in a Vercel Node serverless function.

export async function renderResumeDocx(resume: CanonicalResume): Promise<Buffer> {
  const c = resume.contact;
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun({ text: c.full_name, bold: true })],
    }),
  );

  if (resume.headline) {
    children.push(new Paragraph({ children: [new TextRun({ text: resume.headline, italics: true })] }));
  }

  const contactBits = [c.email, c.phone, c.location, c.linkedin_url, c.website].filter(Boolean);
  if (contactBits.length) {
    children.push(new Paragraph({ children: [new TextRun(contactBits.join('  ·  '))] }));
  }

  const sectionHeading = (text: string) =>
    new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 80 }, children: [new TextRun({ text })] });

  if (resume.summary) {
    children.push(sectionHeading('Summary'));
    children.push(new Paragraph({ children: [new TextRun(resume.summary)] }));
  }

  if (resume.experience.length) {
    children.push(sectionHeading('Experience'));
    for (const e of resume.experience) {
      const heading = [e.title, e.company].filter(Boolean).join(', ');
      children.push(new Paragraph({ children: [new TextRun({ text: heading, bold: true })] }));
      const meta = [e.location, [e.start_date, e.end_date].filter(Boolean).join(' – ')].filter(Boolean).join('  ·  ');
      if (meta) children.push(new Paragraph({ children: [new TextRun({ text: meta, italics: true })] }));
      for (const h of e.highlights) {
        children.push(new Paragraph({ text: h, bullet: { level: 0 } }));
      }
    }
  }

  if (resume.education.length) {
    children.push(sectionHeading('Education'));
    for (const ed of resume.education) {
      children.push(new Paragraph({ children: [new TextRun({ text: ed.institution, bold: true })] }));
      const degree = [ed.degree, ed.field].filter(Boolean).join(', ');
      const meta = [degree, [ed.start_date, ed.end_date].filter(Boolean).join(' – ')].filter(Boolean).join('  ·  ');
      if (meta) children.push(new Paragraph({ children: [new TextRun({ text: meta, italics: true })] }));
    }
  }

  if (resume.skills.length) {
    children.push(sectionHeading('Skills'));
    children.push(new Paragraph({ children: [new TextRun(resume.skills.join(', '))] }));
  }

  if (resume.certifications.length) {
    children.push(sectionHeading('Certifications'));
    for (const cert of resume.certifications) {
      const meta = [cert.issuer, cert.date].filter(Boolean).join(' · ');
      children.push(new Paragraph({ text: `${cert.name}${meta ? ` (${meta})` : ''}`, bullet: { level: 0 } }));
    }
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
    styles: {
      paragraphStyles: [
        { id: 'Title', name: 'Title', basedOn: 'Normal', run: { size: 36 }, paragraph: { alignment: AlignmentType.LEFT } },
      ],
    },
  });

  return Packer.toBuffer(doc);
}
