import 'server-only';
import { adminClient } from '@/lib/supabase/admin';
import { CanonicalResumeSchema } from '@/lib/ai/canonical-resume';
import { renderResumeDocx } from './render-docx';
import { renderResumePdf } from './render-pdf';
import { storeGeneratedAsset } from './store-asset';

// Shared by the generate route and the saveCanonicalMarkdown action: render the
// canonical résumé to .docx + .pdf, store both as candidate_assets, and link them
// back onto the resume_documents row (status -> 'ready'). Verifies ownership.

export async function generateResumeDocuments(
  resumeDocumentId: string,
  userId: string,
): Promise<{ docxAssetId: string; pdfAssetId: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: doc } = await (adminClient.from('resume_documents') as any)
    .select('id, candidate_profile_id, clerk_user_id, canonical_json')
    .eq('id', resumeDocumentId)
    .eq('clerk_user_id', userId)
    .single();

  if (!doc) throw new Error('resume_document not found');

  const resume = CanonicalResumeSchema.parse(doc.canonical_json);
  const safeName = (resume.contact.full_name || 'resume').replace(/[^a-zA-Z0-9._-]/g, '_');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (adminClient.from('resume_documents') as any)
    .update({ status: 'generating', updated_at: new Date().toISOString() })
    .eq('id', resumeDocumentId);

  const [docxBuf, pdfBuf] = await Promise.all([renderResumeDocx(resume), renderResumePdf(resume)]);

  const docxAssetId = await storeGeneratedAsset({
    userId,
    candidateProfileId: doc.candidate_profile_id,
    assetType: 'resume_docx',
    buffer: docxBuf,
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileName: `${safeName}-ATS.docx`,
  });

  const pdfAssetId = await storeGeneratedAsset({
    userId,
    candidateProfileId: doc.candidate_profile_id,
    assetType: 'resume',
    buffer: pdfBuf,
    contentType: 'application/pdf',
    fileName: `${safeName}-ATS.pdf`,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (adminClient.from('resume_documents') as any)
    .update({
      docx_asset_id: docxAssetId,
      pdf_asset_id: pdfAssetId,
      status: 'ready',
      updated_at: new Date().toISOString(),
    })
    .eq('id', resumeDocumentId);

  return { docxAssetId, pdfAssetId };
}
