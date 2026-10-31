-- 站主上传收藏：在 Supabase SQL Editor 中，以项目管理员身份执行。
-- 只配置独立的 gallery_* 表及 gallery-uploads bucket；不开放注册或自动授权用户。
begin;

create table if not exists public.gallery_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table if not exists public.gallery_uploads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  object_path text not null unique,
  thumbnail_path text not null unique,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  alt text not null default '' check (char_length(alt) <= 300),
  credit text not null default '站主上传 · 原作者信息待补充' check (char_length(credit) <= 200),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  constraint gallery_image_pixel_limit check (width::bigint * height <= 40000000),
  created_at timestamptz not null default now(),
  constraint gallery_original_owner_folder check (
    split_part(object_path, '/', 1) = owner_id::text
    and char_length(object_path) between 39 and 300
    and object_path !~ '(^|/)\.\.(/|$)'
  ),
  constraint gallery_thumbnail_owner_folder check (
    split_part(thumbnail_path, '/', 1) = owner_id::text
    and char_length(thumbnail_path) between 39 and 300
    and thumbnail_path !~ '(^|/)\.\.(/|$)'
  )
);

create index if not exists gallery_uploads_created_at_idx
  on public.gallery_uploads (created_at desc, id);

alter table public.gallery_admins enable row level security;
alter table public.gallery_uploads enable row level security;

-- 浏览器只使用公开 key 和登录后的用户 JWT。授权名单只能由 SQL Editor 管理。
revoke all on public.gallery_admins from anon, authenticated;
grant select on public.gallery_admins to authenticated;
revoke all on public.gallery_uploads from anon, authenticated;
grant select on public.gallery_uploads to anon, authenticated;
grant insert, delete on public.gallery_uploads to authenticated;

drop policy if exists gallery_admin_read_self on public.gallery_admins;
create policy gallery_admin_read_self on public.gallery_admins
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists gallery_uploads_public_read on public.gallery_uploads;
create policy gallery_uploads_public_read on public.gallery_uploads
  for select to anon, authenticated using (true);

drop policy if exists gallery_uploads_owner_insert on public.gallery_uploads;
create policy gallery_uploads_owner_insert on public.gallery_uploads
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.gallery_admins where user_id = (select auth.uid()))
  );

drop policy if exists gallery_uploads_owner_delete on public.gallery_uploads;
create policy gallery_uploads_owner_delete on public.gallery_uploads
  for delete to authenticated using (
    owner_id = (select auth.uid())
    and exists (select 1 from public.gallery_admins where user_id = (select auth.uid()))
  );

-- 公开 bucket 只公开读取图片；写入权限仍由 storage.objects 的 RLS 强制检查。
-- 防止上传 HTML/SVG 等主动内容，原图与缩略图均仅允许常规位图格式。
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gallery-uploads', 'gallery-uploads', true, 10485760,
  array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists gallery_storage_owner_read on storage.objects;
create policy gallery_storage_owner_read on storage.objects
  for select to authenticated using (
    bucket_id = 'gallery-uploads'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.gallery_admins where user_id = (select auth.uid()))
  );

drop policy if exists gallery_storage_owner_insert on storage.objects;
create policy gallery_storage_owner_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'gallery-uploads'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.gallery_admins where user_id = (select auth.uid()))
  );

drop policy if exists gallery_storage_owner_delete on storage.objects;
create policy gallery_storage_owner_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'gallery-uploads'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.gallery_admins where user_id = (select auth.uid()))
  );

-- 不提供 UPDATE 策略，不使用 upsert；每次上传使用全新的对象路径。
commit;

-- 接着在 Authentication > Users 创建站主账号，复制该用户 UID，单独执行：
-- insert into public.gallery_admins (user_id)
-- values ('替换为站主账号的 UUID') on conflict (user_id) do nothing;
