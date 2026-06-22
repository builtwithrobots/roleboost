import 'server-only';

// Extract raw text from an uploaded résumé. Pure-JS / WASM only so it runs in a
// Vercel Node serverless function (no native binaries):
//   - PDF  → unpdf (serverless-friendly, no import-time file reads)
//   - DOCX → mammoth (raw text)
//   - TXT  → native decode

export type ResumeMime =
  | 'application/pdf'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'text/plain';

export const RESUME_UPLOAD_MIMES: Record<string, ResumeMime> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
};

export async function extractResumeText(buffer: Buffer, mime: string, ext: string): Promise<string> {
  const kind = mime || RESUME_UPLOAD_MIMES[ext.toLowerCase()] || '';

  if (kind === 'application/pdf' || ext === 'pdf') {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return (Array.isArray(text) ? text.join('\n') : text).trim();
  }

  if (
    kind === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === 'docx'
  ) {
    const mammoth = (await import('mammoth')).default;
    const { value } = await mammoth.extractRawText({ buffer });
    return value.trim();
  }

  // Plain text fallback
  return buffer.toString('utf-8').trim();
}
