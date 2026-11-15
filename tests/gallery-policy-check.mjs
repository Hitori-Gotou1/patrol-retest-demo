// Isolated PostgreSQL execution, NOT a verification of the production Supabase project.
// npm install --prefix /tmp/hitori-gallery-sql-check --no-package-lock @electric-sql/pglite
// HITORI_PGLITE_MODULE=/tmp/hitori-gallery-sql-check/node_modules/@electric-sql/pglite/dist/index.js node tests/gallery-policy-check.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const modulePath=process.env.HITORI_PGLITE_MODULE;
if(!modulePath) throw new Error('Set HITORI_PGLITE_MODULE to the isolated PGlite module path.');
const { PGlite }=await import(pathToFileURL(modulePath).href);
const db=new PGlite();
const owner='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const outsider='33333333-3333-4333-8333-333333333333';
const first='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const hidden='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const second='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const collection='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const checks=[];
async function rows(sql,params=[]){return (await db.query(sql,params)).rows;}
async function as(role,id=''){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec(`set role ${role}`);}
async function denied(sql,params=[]){let failure;try{await db.query(sql,params);}catch(cause){failure=cause;}assert.ok(failure,`Expected permission failure: ${sql}`);}
try {
  await db.exec(`create role anon;create role authenticated;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public,storage to anon,authenticated;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant select,insert,delete on storage.objects to anon,authenticated;
    create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;`);
  await db.exec(await readFile(new URL('../supabase/gallery.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/gallery-upgrade.sql',import.meta.url),'utf8'));
  checks.push('original and additive upgrade SQL execute');
  await db.query('insert into auth.users(id) values($1),($2),($3)',[owner,other,outsider]);
  await db.query('insert into public.gallery_admins(user_id) values($1),($2)',[owner,other]);
  for(const [id,user,published] of [[first,owner,true],[hidden,owner,false],[second,other,true]]) await db.query(`insert into public.gallery_uploads(id,owner_id,object_path,thumbnail_path,title,width,height,published)
    values($1,$2,$3,$4,$5,100,100,$6)`,[id,user,`${user}/${id}.png`,`${user}/${id}-thumb.webp`,id,published]);
  await as('anon');
  assert.equal((await rows('select * from public.gallery_uploads')).length,2);
  await denied("update public.gallery_uploads set title='anonymous edit' where id=$1",[first]);
  await denied("select public.gallery_save_collection($1,'{}'::jsonb,'{}'::text[])",[collection]);
  checks.push('anonymous sees published only and cannot mutate images or collections');
  await as('authenticated',outsider);
  assert.equal((await rows('select * from public.gallery_uploads')).length,2);
  assert.equal((await rows("update public.gallery_uploads set title='intruder edit' where id=$1 returning id",[first])).length,0);
  await denied("insert into storage.objects(bucket_id,name) values('gallery-uploads',$1)",[`${outsider}/${first}.png`]);
  checks.push('non-admin account cannot update rows or upload storage objects');
  await as('authenticated',owner);
  assert.equal((await rows('select * from public.gallery_uploads')).length,3);
  assert.equal((await rows("update public.gallery_uploads set title='owner edit',characters=array['hitori','kita'],tags=array['雨夜'] where id=$1 returning id",[first])).length,1);
  assert.equal((await rows("update public.gallery_uploads set title='cross-owner edit' where id=$1 returning id",[second])).length,0);
  await denied('update public.gallery_uploads set owner_id=$1 where id=$2',[other,first]);
  await denied("update public.gallery_uploads set thumbnail_path='bad' where id=$1",[first]);
  await denied("update public.gallery_uploads set tags=array['<script>'] where id=$1",[first]);
  await denied("update public.gallery_uploads set characters=array['unknown'] where id=$1",[first]);
  await db.query("insert into storage.objects(bucket_id,name) values('gallery-uploads',$1)",[`${owner}/${first}.png`]);
  await denied("insert into storage.objects(bucket_id,name) values('gallery-uploads',$1)",[`${other}/${first}.png`]);
  checks.push('owner edits metadata only; other owner rows, identity, paths and invalid values stay protected');
  await db.query('select public.gallery_save_collection($1,$2::jsonb,$3::text[])',[collection,JSON.stringify({title:'四个人的放学后',description:'test',cover_image_id:`cloud-${first}`,sort_order:0,published:true}),[`cloud-${first}`,'live-ticket']]);
  assert.equal((await rows('select * from public.gallery_collection_items')).length,2);
  await denied('select public.gallery_save_collection($1,$2::jsonb,$3::text[])',[collection,JSON.stringify({title:'invalid replacement',cover_image_id:'cloud-eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'}),['cloud-eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee']]);
  assert.equal((await rows('select * from public.gallery_collection_items')).length,2);
  assert.equal((await rows('select title from public.gallery_collections'))[0].title,'四个人的放学后');
  checks.push('atomic collection RPC preserves prior content when a membership fails');
  await as('authenticated',other);
  await denied('select public.gallery_save_collection($1,$2::jsonb,$3::text[])',[collection,JSON.stringify({title:'cross-owner edit'}),['live-ticket']]);
  assert.equal((await rows('select title from public.gallery_collections'))[0].title,'四个人的放学后');
  checks.push('second owner cannot overwrite an existing owner collection');
  await as('anon');
  assert.equal((await rows('select * from public.gallery_collections')).length,1);
  assert.equal((await rows('select * from public.gallery_collection_items')).length,2);
  await as('authenticated',owner);
  await db.query('update public.gallery_collections set published=false where id=$1',[collection]);
  await as('anon');
  assert.equal((await rows('select * from public.gallery_collections')).length,0);
  assert.equal((await rows('select * from public.gallery_collection_items')).length,0);
  checks.push('unpublished collections and membership are hidden from anonymous visitors');
  await as('postgres');
  const beforeReplay = {
    images: await rows('select * from public.gallery_uploads order by id'),
    collections: await rows('select * from public.gallery_collections order by id'),
    members: await rows('select * from public.gallery_collection_items order by collection_id,sort_order'),
    admins: await rows('select * from public.gallery_admins order by user_id'),
    objects: await rows('select * from storage.objects order by id')
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    await db.exec(await readFile(new URL('../supabase/gallery-upgrade.sql',import.meta.url),'utf8'));
    assert.deepEqual({
      images: await rows('select * from public.gallery_uploads order by id'),
      collections: await rows('select * from public.gallery_collections order by id'),
      members: await rows('select * from public.gallery_collection_items order by collection_id,sort_order'),
      admins: await rows('select * from public.gallery_admins order by user_id'),
      objects: await rows('select * from storage.objects order by id')
    },beforeReplay);
  }
  await as('anon');
  assert.equal((await rows('select * from public.gallery_uploads')).length,2);
  assert.equal((await rows('select * from public.gallery_collections')).length,0);
  await as('authenticated',owner);
  assert.equal((await rows("update public.gallery_uploads set title='still forbidden' where id=$1 returning id",[second])).length,0);
  await denied("update public.gallery_uploads set tags=array['<script>'] where id=$1",[first]);
  checks.push('repeated upgrades preserve all images, metadata, collection membership, admins and objects; RLS remains enforced');
  await as('postgres');
  await db.exec(await readFile(new URL('../supabase/gallery-upgrade-rollback.sql',import.meta.url),'utf8'));
  assert.equal((await rows('select * from public.gallery_uploads')).length,3);
  checks.push('rollback executes and preserves all original image rows');
  // Reproduce the screenshot: preview column + named constraint already exist,
  // while other upgrade objects have not been installed yet.
  await db.exec(`alter table public.gallery_uploads add column preview_path text;
    alter table public.gallery_uploads add constraint gallery_preview_owner_folder check(preview_path is null or (
      split_part(preview_path,'/',1)=owner_id::text and char_length(preview_path) between 39 and 300
      and preview_path !~ '(^|/)\\.\\.(/|$)'));`);
  await db.exec(await readFile(new URL('../supabase/gallery-upgrade.sql',import.meta.url),'utf8'));
  assert.equal((await rows('select * from public.gallery_uploads')).length,3);
  assert.equal((await rows("select count(*)::int as n from pg_catalog.pg_constraint where conrelid='public.gallery_uploads'::regclass and conname='gallery_preview_owner_folder'"))[0].n,1);
  assert.ok((await rows("select to_regclass('public.gallery_collections') as table_name"))[0].table_name);
  const retryImage='ffffffff-ffff-4fff-8fff-ffffffffffff';
  await denied(`insert into public.gallery_uploads(id,owner_id,object_path,thumbnail_path,preview_path,title,width,height)
    values($1,$2,$3,$4,$5,'invalid traversal',100,100)`,[retryImage,owner,`${owner}/${retryImage}.png`,`${owner}/${retryImage}-thumb.webp`,`${owner}/../${retryImage}.webp`]);
  checks.push('existing preview constraint partial setup upgrades successfully without deleting original image rows');
  await db.exec(await readFile(new URL('../supabase/gallery-upgrade-rollback.sql',import.meta.url),'utf8'));
  assert.equal((await rows('select * from public.gallery_uploads')).length,3);
  console.log(JSON.stringify({engine:'isolated PostgreSQL/PGlite',productionVerified:false,checks},null,2));
} finally {await db.close();}
