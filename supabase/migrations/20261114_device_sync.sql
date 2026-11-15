-- Optional per-user synchronization, independent of gallery administrator authentication.
-- Run in Supabase SQL editor as the project database owner. Requires Supabase Auth.
BEGIN;
CREATE TABLE IF NOT EXISTS public.hitori_sync_records (
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  space text NOT NULL CHECK (space IN ('work','draft','favorite','activity','practice','rhythm')),
  entity_id text NOT NULL CHECK (entity_id ~ '^[A-Za-z0-9_-]{1,100}$'),
  payload jsonb,
  deleted boolean NOT NULL DEFAULT false,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_operation uuid NOT NULL,
  PRIMARY KEY (owner_id, space, entity_id),
  CHECK ((deleted AND payload IS NULL) OR (NOT deleted AND payload IS NOT NULL)),
  CHECK (octet_length(coalesce(payload::text, 'null')) <= 900000)
);
ALTER TABLE public.hitori_sync_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hitori_sync_records FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sync_read_own ON public.hitori_sync_records;
CREATE POLICY sync_read_own ON public.hitori_sync_records FOR SELECT TO authenticated USING ((SELECT auth.uid()) = owner_id);
-- All mutation goes through the revision-checked function. Visitors cannot forge owner_id,
-- revisions, another user's data, or bypass capacity limits with direct REST upserts.
REVOKE ALL ON public.hitori_sync_records FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.hitori_sync_records TO authenticated;
CREATE OR REPLACE FUNCTION public.hitori_sync_put(
  p_space text, p_entity_id text, p_payload jsonb, p_deleted boolean,
  p_expected_revision bigint, p_operation uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  old_row public.hitori_sync_records%ROWTYPE;
  result_row public.hitori_sync_records%ROWTYPE;
  row_count bigint;
  work_bytes bigint;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_space IS NULL OR p_space NOT IN ('work','draft','favorite','activity','practice','rhythm')
    OR p_entity_id IS NULL OR p_entity_id !~ '^[A-Za-z0-9_-]{1,100}$'
    OR p_expected_revision IS NULL OR p_expected_revision < 0 OR p_operation IS NULL OR p_deleted IS NULL
    OR (p_deleted AND p_payload IS NOT NULL) OR (NOT p_deleted AND p_payload IS NULL)
    OR octet_length(coalesce(p_payload::text, 'null')) > 900000
  THEN RAISE EXCEPTION 'Invalid sync record' USING ERRCODE = '22023'; END IF;
  -- Serialize mutations for this user, including concurrent different-record quota checks.
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text, 1));
  SELECT * INTO old_row FROM public.hitori_sync_records
    WHERE owner_id = uid AND space = p_space AND entity_id = p_entity_id FOR UPDATE;
  IF old_row.owner_id IS NOT NULL AND old_row.last_operation = p_operation THEN
    RETURN jsonb_build_object('accepted', true, 'record', to_jsonb(old_row) - 'owner_id');
  END IF;
  IF coalesce(old_row.revision, 0) <> p_expected_revision THEN
    RETURN jsonb_build_object('accepted', false, 'record', CASE WHEN old_row.owner_id IS NULL THEN NULL ELSE to_jsonb(old_row) - 'owner_id' END);
  END IF;
  IF NOT p_deleted THEN
    IF p_space = 'work' THEN
      IF jsonb_typeof(p_payload) <> 'object' OR NOT (p_payload ?& array['id','kind','snapshot','at','title']) OR p_payload->>'id' IS DISTINCT FROM p_entity_id
        OR (p_payload->>'kind') NOT IN ('project','photobooth','decorate','comic','graffiti','lights','studio','effects','concert','walk','ambient')
        OR jsonb_typeof(p_payload->'snapshot') <> 'object'
        OR length(coalesce(p_payload->>'title','')) NOT BETWEEN 1 AND 90
        OR jsonb_typeof(p_payload->'at') <> 'number'
        OR octet_length((p_payload->'snapshot')::text) > 700000
        OR length(coalesce(p_payload->>'preview','')) > 180000
      THEN RAISE EXCEPTION 'Invalid work version' USING ERRCODE = '22023'; END IF;
      SELECT count(*), coalesce(sum(octet_length(payload::text)), 0) INTO row_count, work_bytes
        FROM public.hitori_sync_records WHERE owner_id = uid AND space = 'work' AND NOT deleted AND entity_id <> p_entity_id;
      IF row_count >= 24 OR work_bytes + octet_length(p_payload::text) + 1000 > 3145728 THEN
        RAISE EXCEPTION 'Existing work shelf limit: 24 versions / 3 MiB' USING ERRCODE = '54000';
      END IF;
    ELSIF p_space = 'draft' THEN
      IF p_entity_id NOT IN ('project','photobooth','decorate','comic','graffiti','lights','studio','effects','concert','walk','ambient')
        OR jsonb_typeof(p_payload) <> 'object' OR octet_length(p_payload::text) > 700000
      THEN RAISE EXCEPTION 'Invalid draft' USING ERRCODE = '22023'; END IF;
    ELSIF p_space = 'favorite' THEN
      IF p_entity_id !~ '^[a-z0-9][a-z0-9_-]{0,95}$' OR p_payload IS DISTINCT FROM 'true'::jsonb THEN
        RAISE EXCEPTION 'Invalid favorite' USING ERRCODE = '22023'; END IF;
      SELECT count(*) INTO row_count FROM public.hitori_sync_records WHERE owner_id = uid AND space = p_space AND NOT deleted AND entity_id <> p_entity_id;
      IF row_count >= 5000 THEN RAISE EXCEPTION 'Favorite limit reached' USING ERRCODE = '54000'; END IF;
    ELSIF p_space = 'activity' THEN
      IF jsonb_typeof(p_payload) <> 'object' OR jsonb_typeof(p_payload->'rank') <> 'number'
        OR (p_payload->>'rank') !~ '^\d{1,2}$' THEN RAISE EXCEPTION 'Invalid activity rank' USING ERRCODE = '22023'; END IF;
      SELECT count(*) INTO row_count FROM public.hitori_sync_records WHERE owner_id = uid AND space = p_space AND NOT deleted AND entity_id <> p_entity_id;
      IF row_count >= 100 THEN RAISE EXCEPTION 'Activity favorite limit reached' USING ERRCODE = '54000'; END IF;
    ELSIF p_space = 'practice' THEN
      IF jsonb_typeof(p_payload) <> 'object' OR p_payload->>'id' IS DISTINCT FROM p_entity_id
        OR coalesce(p_payload->>'date','') !~ '^\d{4}-\d{2}-\d{2}$'
        OR octet_length(p_payload::text) > 4000 THEN RAISE EXCEPTION 'Invalid practice log' USING ERRCODE = '22023'; END IF;
    ELSIF p_space = 'rhythm' THEN
      IF p_entity_id NOT IN ('easy','normal','hard') OR jsonb_typeof(p_payload) <> 'number'
        OR p_payload::text !~ '^\d{1,9}$' OR p_payload::numeric > 100000000 THEN
        RAISE EXCEPTION 'Invalid rhythm score' USING ERRCODE = '22023'; END IF;
    END IF;
  END IF;
  IF old_row.owner_id IS NULL THEN
    SELECT count(*) INTO row_count FROM public.hitori_sync_records WHERE owner_id = uid;
    IF row_count >= 6500 THEN RAISE EXCEPTION 'Sync record limit reached; contact owner for tombstone retention maintenance' USING ERRCODE = '54000'; END IF;
  END IF;
  INSERT INTO public.hitori_sync_records(owner_id, space, entity_id, payload, deleted, revision, updated_at, last_operation)
    VALUES (uid, p_space, p_entity_id, p_payload, p_deleted, coalesce(old_row.revision, 0) + 1, now(), p_operation)
    ON CONFLICT (owner_id, space, entity_id) DO UPDATE SET payload = EXCLUDED.payload, deleted = EXCLUDED.deleted,
      revision = EXCLUDED.revision, updated_at = EXCLUDED.updated_at, last_operation = EXCLUDED.last_operation
    RETURNING * INTO result_row;
  RETURN jsonb_build_object('accepted', true, 'record', to_jsonb(result_row) - 'owner_id');
END;
$$;
REVOKE ALL ON FUNCTION public.hitori_sync_put(text,text,jsonb,boolean,bigint,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hitori_sync_put(text,text,jsonb,boolean,bigint,uuid) TO authenticated;
COMMIT;
