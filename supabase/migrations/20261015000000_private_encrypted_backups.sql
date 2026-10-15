-- RASD: encrypted, per-user cloud backups, separate from application data.
-- This only creates a private Storage bucket and policies. It never reads
-- financial data, performs backups, or modifies existing account records.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('rasd-private-backups', 'rasd-private-backups', FALSE, 26214400, ARRAY['application/json'])
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets
             WHERE id = 'rasd-private-backups'
               AND (public IS DISTINCT FROM FALSE OR file_size_limit IS NULL
                    OR file_size_limit > 26214400)) THEN
    RAISE EXCEPTION 'rasd-private-backups must be private with a maximum size of 25 MiB';
  END IF;
END
$$;

CREATE POLICY "rasd backup select own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'rasd-private-backups'
         AND (storage.foldername(name))[1] = (select auth.uid())::text);

CREATE POLICY "rasd backup insert own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'rasd-private-backups'
              AND (storage.foldername(name))[1] = (select auth.uid())::text);

CREATE POLICY "rasd backup delete own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'rasd-private-backups'
         AND (storage.foldername(name))[1] = (select auth.uid())::text);

-- No UPDATE policy: encrypted backup versions are immutable. Never use upsert.
-- No anon policies and no public URL generation.
