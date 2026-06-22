import 'server-only';
import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import type { CanonicalResume } from '@/lib/ai/canonical-resume';

// Render the canonical résumé to an ATS-readable PDF (selectable text) Buffer.
// @react-pdf/renderer is pure JS — runs in a Vercel Node serverless function.

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, lineHeight: 1.4, color: '#1A1A1A' },
  name: { fontSize: 20, fontWeight: 'bold' },
  headline: { fontSize: 11, fontStyle: 'italic', marginTop: 2 },
  contact: { fontSize: 9, color: '#444', marginTop: 4 },
  section: { fontSize: 12, fontWeight: 'bold', marginTop: 14, marginBottom: 4, borderBottom: '1pt solid #999', paddingBottom: 2 },
  entryHeading: { fontSize: 10.5, fontWeight: 'bold', marginTop: 6 },
  entryMeta: { fontSize: 9, fontStyle: 'italic', color: '#555' },
  bullet: { marginTop: 2, marginLeft: 10 },
  para: { marginTop: 2 },
});

function ResumePDF({ resume }: { resume: CanonicalResume }) {
  const c = resume.contact;
  const contactBits = [c.email, c.phone, c.location, c.linkedin_url, c.website].filter(Boolean);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.name}>{c.full_name}</Text>
        {resume.headline ? <Text style={styles.headline}>{resume.headline}</Text> : null}
        {contactBits.length ? <Text style={styles.contact}>{contactBits.join('  ·  ')}</Text> : null}

        {resume.summary ? (
          <View>
            <Text style={styles.section}>Summary</Text>
            <Text style={styles.para}>{resume.summary}</Text>
          </View>
        ) : null}

        {resume.experience.length ? (
          <View>
            <Text style={styles.section}>Experience</Text>
            {resume.experience.map((e, i) => {
              const meta = [e.location, [e.start_date, e.end_date].filter(Boolean).join(' – ')].filter(Boolean).join('  ·  ');
              return (
                <View key={i} wrap={false}>
                  <Text style={styles.entryHeading}>{[e.title, e.company].filter(Boolean).join(', ')}</Text>
                  {meta ? <Text style={styles.entryMeta}>{meta}</Text> : null}
                  {e.highlights.map((h, j) => (
                    <Text key={j} style={styles.bullet}>• {h}</Text>
                  ))}
                </View>
              );
            })}
          </View>
        ) : null}

        {resume.education.length ? (
          <View>
            <Text style={styles.section}>Education</Text>
            {resume.education.map((ed, i) => {
              const degree = [ed.degree, ed.field].filter(Boolean).join(', ');
              const meta = [degree, [ed.start_date, ed.end_date].filter(Boolean).join(' – ')].filter(Boolean).join('  ·  ');
              return (
                <View key={i} wrap={false}>
                  <Text style={styles.entryHeading}>{ed.institution}</Text>
                  {meta ? <Text style={styles.entryMeta}>{meta}</Text> : null}
                </View>
              );
            })}
          </View>
        ) : null}

        {resume.skills.length ? (
          <View>
            <Text style={styles.section}>Skills</Text>
            <Text style={styles.para}>{resume.skills.join(', ')}</Text>
          </View>
        ) : null}

        {resume.certifications.length ? (
          <View>
            <Text style={styles.section}>Certifications</Text>
            {resume.certifications.map((cert, i) => {
              const meta = [cert.issuer, cert.date].filter(Boolean).join(' · ');
              return (
                <Text key={i} style={styles.bullet}>• {cert.name}{meta ? ` (${meta})` : ''}</Text>
              );
            })}
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

export async function renderResumePdf(resume: CanonicalResume): Promise<Buffer> {
  const buf = await renderToBuffer(<ResumePDF resume={resume} />);
  return Buffer.from(buf);
}
