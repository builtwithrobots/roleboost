import 'server-only';
import JSZip from 'jszip';
import { parseCsvRecords } from './csv';

// Parses a LinkedIn "Get a copy of your data" export (.zip of CSVs) into one
// consolidated, human-readable text blob the AI brain can ground on. We pull the
// high-signal files -- Profile, Positions, Education, Skills, Certifications, and
// (the sleeper hit) Recommendations Received -- and ignore the rest.
//
// LinkedIn filenames are stable but occasionally re-cased or suffixed, so we
// match by a case-insensitive substring of the base name.

const MAX_OUTPUT_CHARS = 50000;

function pick(value: string | undefined): string {
  return (value ?? '').trim();
}

function joined(...parts: (string | undefined)[]): string {
  return parts.map(pick).filter(Boolean).join(' · ');
}

async function readCsv(zip: JSZip, nameFragment: string): Promise<Record<string, string>[]> {
  const entry = Object.values(zip.files).find(
    (f) => !f.dir && f.name.toLowerCase().includes(nameFragment.toLowerCase()) && f.name.toLowerCase().endsWith('.csv'),
  );
  if (!entry) return [];
  try {
    return parseCsvRecords(await entry.async('string'));
  } catch {
    return [];
  }
}

export async function parseLinkedInExport(buffer: Buffer): Promise<string> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error('That file is not a readable .zip export');
  }

  const sections: string[] = [];

  // Profile (headline + summary).
  const profile = (await readCsv(zip, 'Profile'))[0];
  if (profile) {
    const name = joined(profile['First Name'], profile['Last Name']);
    const headline = pick(profile['Headline']);
    const summary = pick(profile['Summary']);
    const where = joined(profile['Geo Location'], profile['Industry']);
    const bits = [name && `Name: ${name}`, headline && `Headline: ${headline}`, where && `Location: ${where}`, summary && `Summary: ${summary}`].filter(Boolean);
    if (bits.length) sections.push(`## LinkedIn profile\n${bits.join('\n')}`);
  }

  // Positions.
  const positions = await readCsv(zip, 'Positions');
  if (positions.length) {
    const lines = positions.map((p) => {
      const role = joined(p['Title'], p['Company Name']);
      const dates = joined(p['Started On'], p['Finished On'] || 'Present');
      const desc = pick(p['Description']);
      return `- ${role}${dates ? ` (${dates})` : ''}${desc ? `\n  ${desc.replace(/\n+/g, ' ')}` : ''}`;
    });
    sections.push(`## Experience (LinkedIn)\n${lines.join('\n')}`);
  }

  // Education.
  const education = await readCsv(zip, 'Education');
  if (education.length) {
    const lines = education.map((e) =>
      `- ${joined(e['School Name'], e['Degree Name'], e['Notes'])}${joined(e['Start Date'], e['End Date']) ? ` (${joined(e['Start Date'], e['End Date'])})` : ''}`,
    );
    sections.push(`## Education (LinkedIn)\n${lines.join('\n')}`);
  }

  // Skills.
  const skills = (await readCsv(zip, 'Skills')).map((s) => pick(s['Name'])).filter(Boolean);
  if (skills.length) sections.push(`## Skills (LinkedIn)\n${skills.join(', ')}`);

  // Certifications.
  const certs = await readCsv(zip, 'Certifications');
  if (certs.length) {
    const lines = certs.map((c) => `- ${joined(c['Name'], c['Authority'], c['Started On'])}`);
    sections.push(`## Certifications (LinkedIn)\n${lines.join('\n')}`);
  }

  // Recommendations received -- third-party voice + validation.
  const recs = await readCsv(zip, 'Recommendations_Received');
  const recsReceived = recs.length ? recs : await readCsv(zip, 'Recommendations Received');
  if (recsReceived.length) {
    const lines = recsReceived
      .map((r) => {
        const from = joined(r['First Name'], r['Last Name']);
        const text = pick(r['Text']);
        return text ? `- From ${from || 'a colleague'}: "${text.replace(/\n+/g, ' ')}"` : '';
      })
      .filter(Boolean);
    if (lines.length) sections.push(`## Recommendations received (LinkedIn)\n${lines.join('\n')}`);
  }

  if (sections.length === 0) {
    throw new Error('No recognizable LinkedIn data found in that export');
  }

  return sections.join('\n\n').slice(0, MAX_OUTPUT_CHARS).trim();
}
