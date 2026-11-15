// Real SQL execution in isolated PostgreSQL/PGlite, not production Supabase.
// Reuse an isolated @electric-sql/pglite installation; never a production connection.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
if (!process.env.HITORI_PGLITE_MODULE) throw new Error('Set HITORI_PGLITE_MODULE to an isolated PGlite install.');
const { PGlite } = await import(pathToFileURL(process.env.HITORI_PGLITE_MODULE).href);
const db = new PGlite();
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',C='33333333-3333-4333-8333-333333333333';
const checks=[];
const rows = async(sql,params=[]) => (await db.query(sql,params)).rows;
async function role(name,uid=''){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);await db.exec(`set role ${name}`);}
async function denied(action,code){let error;try{await action();}catch(reason){error=reason;}assert.ok(error,'Expected SQL rejection');if(code)assert.equal(error.code,code);}
async function put(space,id,payload,revision=0,deleted=false,operation=crypto.randomUUID()){
 return (await rows('select public.hitori_sync_put($1,$2,$3::jsonb,$4,$5,$6::uuid) as result',[space,id,payload===null?null:JSON.stringify(payload),deleted,revision,operation]))[0].result;
}
const work=(id,extra={})=>({id,kind:'studio',snapshot:{version:1,name:'SQL test',bpm:96,masks:[1,1,1,1],...extra},at:1,title:id,preview:'',tags:[],pinned:false});
try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public to anon,authenticated;create table public.gallery_untouched(id integer primary key);insert into public.gallery_untouched values(42);`);
 for(const id of [A,B,C])await db.query('insert into auth.users values($1)',[id]);
 await db.exec(await readFile(new URL('../supabase/migrations/20261114_device_sync.sql',import.meta.url),'utf8'));
 checks.push('sync migration executes in actual isolated PostgreSQL');
 await role('anon');await denied(()=>rows('select * from public.hitori_sync_records'),'42501');await denied(()=>put('favorite','public-test',true),'42501');
 checks.push('anonymous table reads and RPC writes denied by database privileges');
 await role('authenticated',A);const operation=crypto.randomUUID();let first=await put('favorite','same-id',true,0,false,operation);assert.equal(first.accepted,true);assert.equal(first.record.revision,1);assert.ok(!('owner_id' in first.record));
 let retry=await put('favorite','same-id',true,0,false,operation);assert.equal(retry.record.revision,1);
 let stale=await put('favorite','same-id',true,0);assert.equal(stale.accepted,false);assert.equal(stale.record.revision,1);
 checks.push('revision CAS rejects stale edits and idempotent operation does not add a revision');
 await denied(()=>rows('insert into public.hitori_sync_records(owner_id,space,entity_id,payload,last_operation) values($1,$2,$3,$4::jsonb,$5)',[B,'favorite','forged','true',crypto.randomUUID()]),'42501');
 await role('authenticated',B);assert.equal((await rows('select * from public.hitori_sync_records')).length,0);assert.equal((await put('favorite','same-id',true)).accepted,true);assert.equal((await rows('select * from public.hitori_sync_records'))[0].owner_id,B);
 await role('authenticated',A);assert.equal((await rows('select * from public.hitori_sync_records')).length,1);
 checks.push('two authenticated owners stay isolated, same entity ID is scoped, direct forged writes denied');
 const tombstone=await put('favorite','same-id',null,1,true);assert.equal(tombstone.record.revision,2);assert.equal(tombstone.record.deleted,true);assert.equal(tombstone.record.payload,null);
 await denied(()=>put('draft','unrecognized-tool',{}),'22023');await denied(()=>put('favorite','invalid-payload',{}),'22023');await denied(()=>put('rhythm','easy',-1),'22023');
 checks.push('tombstones retain revisions and malformed scopes/payloads are rejected');
 for(let i=0;i<24;i++){const id='work-'+i;assert.equal((await put('work',id,work(id))).accepted,true);}
 await denied(()=>put('work','work-24',work('work-24')),'54000');
 assert.equal((await put('work','work-0',null,1,true)).accepted,true);assert.equal((await put('work','work-24',work('work-24'))).accepted,true);
 assert.equal((await rows("select count(*)::integer as count from public.hitori_sync_records where space='work' and not deleted"))[0].count,24);
 checks.push('24-version limit is enforced and delete-before-replacement works at full capacity');
 await role('authenticated',C);
 for(let i=0;i<4;i++){const id='large-'+i;assert.equal((await put('work',id,work(id,{text:'x'.repeat(650000)}))).accepted,true);}
 await denied(()=>put('work','large-4',work('large-4',{text:'x'.repeat(650000)})),'54000');
 checks.push('unchanged 3 MiB shelf limit is enforced by actual database RPC');
 await role('postgres');await db.exec(await readFile(new URL('../supabase/migrations/20261114_device_sync.rollback.sql',import.meta.url),'utf8'));
 assert.equal((await rows('select * from public.gallery_untouched'))[0].id,42);assert.equal((await rows("select to_regclass('public.hitori_sync_records') as name"))[0].name,null);
 checks.push('rollback executes and leaves unrelated gallery tables intact');
 const report={engine:'isolated PostgreSQL/PGlite',productionVerified:false,checks};await writeFile(new URL('../evidence/sync-review/database-results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await db.close();}
