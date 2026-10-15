BEGIN;
DO $$
DECLARE
  v_p record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets
    WHERE id = 'rasd-private-backups' AND public IS FALSE
      AND file_size_limit = 26214400
      AND allowed_mime_types = ARRAY['application/json']::text[]) THEN
    RAISE EXCEPTION 'Cloud backup bucket must be private and size-restricted';
  END IF;
  IF (SELECT count(*) FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname IN ('rasd backup select own','rasd backup insert own','rasd backup delete own')) <> 3 THEN
    RAISE EXCEPTION 'Cloud backup RLS policy set is missing';
  END IF;
  FOR v_p IN SELECT * FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname IN ('rasd backup select own','rasd backup insert own','rasd backup delete own')
  LOOP
    IF NOT ('authenticated' = ANY(v_p.roles)) OR ('public' = ANY(v_p.roles)) THEN
      RAISE EXCEPTION 'Backup policy is not confined to authenticated users: %', v_p.policyname;
    END IF;
    IF position('rasd-private-backups' in coalesce(v_p.qual,'') || coalesce(v_p.with_check,'')) = 0
       OR position('uid()' in coalesce(v_p.qual,'') || coalesce(v_p.with_check,'')) = 0 THEN
      RAISE EXCEPTION 'Backup policy missing bucket/owner restriction: %', v_p.policyname;
    END IF;
  END LOOP;
END $$;
ROLLBACK;
