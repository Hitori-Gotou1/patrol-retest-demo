-- Stop synchronization in the website before running this rollback.
-- This removes only cloud sync data; it does not touch gallery tables or browser works/drafts.
-- To retain cloud data, rename hitori_sync_records to an archive table instead of dropping it.
BEGIN;
DROP FUNCTION IF EXISTS public.hitori_sync_put(text,text,jsonb,boolean,bigint,uuid);
DROP TABLE IF EXISTS public.hitori_sync_records;
COMMIT;
