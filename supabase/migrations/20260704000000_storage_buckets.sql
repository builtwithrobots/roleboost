-- Provision the private Storage buckets the app uploads to.
--
-- These buckets were previously expected to be created by hand in the Supabase
-- dashboard, so fresh projects / preview branches hit "Bucket not found" on the
-- first upload. Making them part of the schema guarantees every environment has
-- them. All are private (public = false); the app serves files via short-lived
-- signed URLs generated server-side.

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('candidate-audio', 'candidate-audio', false),
  ('candidate-video', 'candidate-video', false),
  ('candidate-documents', 'candidate-documents', false),
  ('candidate-images', 'candidate-images', false)
ON CONFLICT (id) DO NOTHING;

-- Owner access to objects under the candidate's own "{clerk_user_id}/" prefix.
-- Uploads and public-page signing run through the service-role client (which
-- bypasses RLS), but the candidate dashboard signs its own asset URLs with the
-- authenticated (RLS) client, so it needs this SELECT/ALL policy. The path
-- pattern is "{clerk_user_id}/{timestamp}-{file}", so the first folder segment
-- is the owner id, matched against the Clerk JWT sub via requesting_user_id().
DROP POLICY IF EXISTS candidate_buckets_owner_access ON storage.objects;
CREATE POLICY candidate_buckets_owner_access ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id IN ('candidate-audio', 'candidate-video', 'candidate-documents', 'candidate-images')
    AND (storage.foldername(name))[1] = public.requesting_user_id()
  )
  WITH CHECK (
    bucket_id IN ('candidate-audio', 'candidate-video', 'candidate-documents', 'candidate-images')
    AND (storage.foldername(name))[1] = public.requesting_user_id()
  );
