import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { generateResumeDocuments } from '@/lib/resume/generate';

// Node runtime: docx + @react-pdf/renderer need Node APIs / Buffer.
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: { code: 'UNAUTHENTICATED' } }, { status: 401 });

  let body: { resume_document_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { code: 'INVALID_INPUT' } }, { status: 400 });
  }
  if (!body.resume_document_id) {
    return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'Missing resume_document_id' } }, { status: 400 });
  }

  try {
    const result = await generateResumeDocuments(body.resume_document_id, userId);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'generation failed';
    // Ownership failures surface as "not found" from the scoped query.
    const status = message.includes('not found') ? 404 : 500;
    console.error('resume generate failed', userId, e);
    return NextResponse.json({ error: { code: status === 404 ? 'NOT_FOUND' : 'INTERNAL', message } }, { status });
  }
}
