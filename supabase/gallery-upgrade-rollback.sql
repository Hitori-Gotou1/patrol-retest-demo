-- Run only after rolling the frontend back to the pre-upgrade release.
-- This removes curator metadata/collections, NOT images, originals, favorites or image IDs.
-- Export any curator fields/collections to a database snapshot before using this rollback.
begin;
drop function if exists public.gallery_save_collection(uuid,jsonb,text[]);
drop table if exists public.gallery_collection_items;
drop table if exists public.gallery_collections;
drop trigger if exists gallery_uploads_metadata_touch on public.gallery_uploads;
drop function if exists public.gallery_touch_updated_at();
drop policy if exists gallery_uploads_owner_update on public.gallery_uploads;
drop policy if exists gallery_uploads_owner_read on public.gallery_uploads;
drop policy if exists gallery_uploads_public_read on public.gallery_uploads;
create policy gallery_uploads_public_read on public.gallery_uploads for select to anon,authenticated using(true);
revoke update on public.gallery_uploads from authenticated;
revoke update(title,alt,credit,characters,category,tags,creator,source_url,published,sort_order) on public.gallery_uploads from authenticated;
drop index if exists public.gallery_uploads_content_digest_idx;
drop index if exists public.gallery_uploads_public_order_idx;
alter table public.gallery_uploads
 drop constraint if exists gallery_preview_owner_folder,
 drop constraint if exists gallery_explicit_characters,
 drop constraint if exists gallery_category_token,
 drop constraint if exists gallery_tags_valid,
 drop constraint if exists gallery_creator_length,
 drop constraint if exists gallery_source_url_valid,
 drop constraint if exists gallery_sort_order_range,
 drop constraint if exists gallery_digest_valid;
alter table public.gallery_uploads
 drop column if exists preview_path,
 drop column if exists characters,
 drop column if exists category,
 drop column if exists tags,
 drop column if exists creator,
 drop column if exists source_url,
 drop column if exists published,
 drop column if exists sort_order,
 drop column if exists content_sha256,
 drop column if exists updated_at;
drop function if exists public.gallery_valid_tags(text[]);
commit;
-- Storage derivatives deliberately remain: removing them could break a cached upgraded tab.
-- A public-read rollback also makes previously hidden images visible, matching the old site.
