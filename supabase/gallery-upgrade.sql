-- Repeat-safe additive upgrade after gallery.sql. Run as project database administrator.
-- Safe to rerun after a previous successful run or supported partial setup; existing rows are preserved.
-- Does not rewrite old image metadata or alter the public bucket / original image IDs.
begin;

alter table public.gallery_uploads
  add column if not exists preview_path text,
  add column if not exists characters text[],
  add column if not exists category text not null default 'collection',
  add column if not exists tags text[] not null default '{}',
  add column if not exists creator text not null default '',
  add column if not exists source_url text not null default '',
  add column if not exists published boolean not null default true,
  add column if not exists sort_order integer not null default 0,
  add column if not exists content_sha256 text,
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.gallery_valid_tags(value text[])
returns boolean language sql immutable set search_path = '' as $$
  select cardinality(value) <= 8
    and not exists(select 1 from unnest(value) tag where tag is null or char_length(btrim(tag)) not between 1 and 20 or tag ~ '[[:cntrl:]<>]')
    and cardinality(value) = (select count(distinct tag) from unnest(value) tag);
$$;

-- ADD CONSTRAINT has no IF NOT EXISTS form; check the target table explicitly.
do $gallery_constraints$
begin
  if not exists (select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.gallery_uploads'::regclass and conname = 'gallery_preview_owner_folder') then
    alter table public.gallery_uploads add constraint gallery_preview_owner_folder check (preview_path is null or (
    split_part(preview_path, '/', 1) = owner_id::text
    and char_length(preview_path) between 39 and 300
    and preview_path !~ '(^|/)\.\.(/|$)'));
  end if;
  if not exists (select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.gallery_uploads'::regclass and conname = 'gallery_explicit_characters') then
    alter table public.gallery_uploads add constraint gallery_explicit_characters check (characters is null or (
    cardinality(characters) <= 4 and characters <@ array['hitori','nijika','ryo','kita']::text[]));
  end if;
  if not exists (select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.gallery_uploads'::regclass and conname = 'gallery_category_token') then
    alter table public.gallery_uploads add constraint gallery_category_token check (category ~ '^[a-z][a-z0-9-]{0,31}$');
  end if;
  if not exists (select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.gallery_uploads'::regclass and conname = 'gallery_tags_valid') then
    alter table public.gallery_uploads add constraint gallery_tags_valid check (public.gallery_valid_tags(tags));
  end if;
  if not exists (select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.gallery_uploads'::regclass and conname = 'gallery_creator_length') then
    alter table public.gallery_uploads add constraint gallery_creator_length check (char_length(creator) <= 120);
  end if;
  if not exists (select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.gallery_uploads'::regclass and conname = 'gallery_source_url_valid') then
    alter table public.gallery_uploads add constraint gallery_source_url_valid check (source_url = '' or (char_length(source_url) <= 1000 and source_url ~ '^https?://[^[:space:]]+$'));
  end if;
  if not exists (select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.gallery_uploads'::regclass and conname = 'gallery_sort_order_range') then
    alter table public.gallery_uploads add constraint gallery_sort_order_range check (sort_order between -1000000 and 1000000);
  end if;
  if not exists (select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.gallery_uploads'::regclass and conname = 'gallery_digest_valid') then
    alter table public.gallery_uploads add constraint gallery_digest_valid check (content_sha256 is null or content_sha256 ~ '^[a-f0-9]{64}$');
  end if;
end;
$gallery_constraints$;

create unique index if not exists gallery_uploads_content_digest_idx on public.gallery_uploads(content_sha256) where content_sha256 is not null;
create index if not exists gallery_uploads_public_order_idx on public.gallery_uploads(sort_order,created_at desc,id desc) where published;

create or replace function public.gallery_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- IDs, ownership and resource paths are immutable during metadata edits.
  if new.id <> old.id or new.owner_id <> old.owner_id or new.object_path <> old.object_path
    or new.thumbnail_path <> old.thumbnail_path or new.preview_path is distinct from old.preview_path
    or new.content_sha256 is distinct from old.content_sha256 then
    raise exception 'Image identity and resources cannot be changed by a metadata edit';
  end if;
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists gallery_uploads_metadata_touch on public.gallery_uploads;
create trigger gallery_uploads_metadata_touch before update on public.gallery_uploads
for each row execute function public.gallery_touch_updated_at();

drop policy if exists gallery_uploads_public_read on public.gallery_uploads;
create policy gallery_uploads_public_read on public.gallery_uploads
for select to anon,authenticated using (published);
drop policy if exists gallery_uploads_owner_read on public.gallery_uploads;
create policy gallery_uploads_owner_read on public.gallery_uploads
for select to authenticated using (
  owner_id = (select auth.uid()) and exists(select 1 from public.gallery_admins where user_id = (select auth.uid())));
grant update(title,alt,credit,characters,category,tags,creator,source_url,published,sort_order) on public.gallery_uploads to authenticated;
drop policy if exists gallery_uploads_owner_update on public.gallery_uploads;
create policy gallery_uploads_owner_update on public.gallery_uploads
for update to authenticated
using (owner_id = (select auth.uid()) and exists(select 1 from public.gallery_admins where user_id = (select auth.uid())))
with check (owner_id = (select auth.uid()) and exists(select 1 from public.gallery_admins where user_id = (select auth.uid())));

create table if not exists public.gallery_collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  title text not null check(char_length(btrim(title)) between 1 and 80),
  description text not null default '' check(char_length(description) <= 600),
  cover_image_id text not null default '' check(cover_image_id = '' or cover_image_id ~ '^[a-z0-9][a-z0-9_-]{0,95}$'),
  sort_order integer not null default 0 check(sort_order between -1000000 and 1000000),
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.gallery_collection_items (
  collection_id uuid not null references public.gallery_collections(id) on delete cascade,
  image_id text not null check(image_id ~ '^[a-z0-9][a-z0-9_-]{0,95}$'),
  sort_order integer not null check(sort_order between 0 and 499),
  primary key(collection_id,image_id),
  unique(collection_id,sort_order)
);
create index if not exists gallery_collections_order_idx on public.gallery_collections(sort_order,created_at desc);
alter table public.gallery_collections enable row level security;
alter table public.gallery_collection_items enable row level security;
revoke all on public.gallery_collections,public.gallery_collection_items from anon,authenticated;
grant select on public.gallery_collections,public.gallery_collection_items to anon,authenticated;
grant insert,update,delete on public.gallery_collections,public.gallery_collection_items to authenticated;
drop policy if exists gallery_collections_public_read on public.gallery_collections;
create policy gallery_collections_public_read on public.gallery_collections for select to anon,authenticated using(published);
drop policy if exists gallery_collections_owner_all on public.gallery_collections;
create policy gallery_collections_owner_all on public.gallery_collections for all to authenticated
using(owner_id = (select auth.uid()) and exists(select 1 from public.gallery_admins where user_id = (select auth.uid())))
with check(owner_id = (select auth.uid()) and exists(select 1 from public.gallery_admins where user_id = (select auth.uid())));
drop policy if exists gallery_collection_items_public_read on public.gallery_collection_items;
create policy gallery_collection_items_public_read on public.gallery_collection_items for select to anon,authenticated
using(exists(select 1 from public.gallery_collections where id=collection_id and published));
drop policy if exists gallery_collection_items_owner_all on public.gallery_collection_items;
create policy gallery_collection_items_owner_all on public.gallery_collection_items for all to authenticated
using(exists(select 1 from public.gallery_collections where id=collection_id and owner_id=(select auth.uid()))
  and exists(select 1 from public.gallery_admins where user_id=(select auth.uid())))
with check(exists(select 1 from public.gallery_collections where id=collection_id and owner_id=(select auth.uid()))
  and exists(select 1 from public.gallery_admins where user_id=(select auth.uid())));

-- Transactional mutation: an invalid membership/permission rolls back the entire change.
-- SECURITY INVOKER deliberately keeps every table operation subject to the caller's RLS.
create or replace function public.gallery_save_collection(collection_id uuid, details jsonb, image_ids text[])
returns uuid language plpgsql security invoker set search_path = '' as $$
declare member text; member_order integer := 0;
begin
  if auth.uid() is null or not exists(select 1 from public.gallery_admins where user_id=auth.uid()) then
    raise exception 'Only a gallery owner can curate collections' using errcode='42501';
  end if;
  if cardinality(image_ids) > 500 or cardinality(image_ids) <> (select count(distinct id) from unnest(image_ids) id) then
    raise exception 'Collection must contain at most 500 unique image IDs';
  end if;
  if coalesce(details->>'cover_image_id','') <> '' and not (details->>'cover_image_id' = any(image_ids)) then
    raise exception 'Cover must be a member of this collection';
  end if;
  insert into public.gallery_collections(id,owner_id,title,description,cover_image_id,sort_order,published)
  values(collection_id,auth.uid(),details->>'title',coalesce(details->>'description',''),coalesce(details->>'cover_image_id',''),coalesce((details->>'sort_order')::integer,0),coalesce((details->>'published')::boolean,true))
  on conflict(id) do update set title=excluded.title,description=excluded.description,
    cover_image_id=excluded.cover_image_id,sort_order=excluded.sort_order,published=excluded.published,updated_at=now();
  delete from public.gallery_collection_items where gallery_collection_items.collection_id=gallery_save_collection.collection_id;
  foreach member in array image_ids loop
    if member like 'cloud-%' and not exists(select 1 from public.gallery_uploads where 'cloud-' || id::text = member) then
      raise exception 'Cloud image does not exist or is not accessible: %',member;
    end if;
    insert into public.gallery_collection_items(collection_id,image_id,sort_order) values(collection_id,member,member_order);
    member_order:=member_order+1;
  end loop;
  return collection_id;
end;
$$;
revoke all on function public.gallery_save_collection(uuid,jsonb,text[]) from public,anon;
grant execute on function public.gallery_save_collection(uuid,jsonb,text[]) to authenticated;
commit;
