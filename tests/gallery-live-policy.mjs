// Opt-in REAL Supabase acceptance. Never part of npm test and never reads owner sessions.
// Uses only the exact UUIDs generated during this invocation, then removes them in finally.
import { createHash, randomUUID } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { validateGalleryConfig } from '../src/services/galleryCloudConfig.js';

export const EXPECTED_GALLERY_TEST_A_UID = 'f72aa1d6-393d-4a6a-a0e0-709537ed170a';
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const requiredNames = ['URL', 'PUBLIC_KEY', 'A_EMAIL', 'A_PASSWORD', 'B_EMAIL', 'B_PASSWORD'];
class AcceptanceFailure extends Error {
  constructor(check, code = 'CHECK_FAILED') { super(check); this.check = check; this.safeCode = /^[A-Z0-9_-]{1,32}$/i.test(String(code)) ? String(code) : 'SERVICE_ERROR'; }
}
const fail = (name, code) => { throw new AcceptanceFailure(name, code); };
const ensure = (condition, name) => { if (!condition) fail(name); };
const codeOf = error => /^[A-Z0-9_-]{1,32}$/i.test(String(error?.code || '')) ? String(error.code) : 'SERVICE_ERROR';
const permissionFailure = error => error?.code === '42501' || [error?.status, error?.statusCode].some(value => [401, 403].includes(Number(value)));
const ok = (result, name) => { if (result.error) fail(name, codeOf(result.error)); return result.data; };
const policyBlocked = (result, name, emptyAllowed = false) => {
  if (result.error) ensure(permissionFailure(result.error), name);
  else ensure(emptyAllowed && Array.isArray(result.data) && result.data.length === 0, name);
};

export function readGalleryLiveConfig(env) {
  if (env.HITORI_SYNC_TEST_ALLOW_WRITES !== 'yes-isolated-accounts') fail('explicit_isolated_write_authorization_required', 'CONFIG');
  if (requiredNames.some(name => !env[`HITORI_SYNC_TEST_${name}`])) fail('isolated_account_configuration_required', 'CONFIG');
  const url = env.HITORI_SYNC_TEST_URL.replace(/\/$/, '');
  try {
    if (!validateGalleryConfig(url, env.HITORI_SYNC_TEST_PUBLIC_KEY)) fail('public_configuration_required', 'CONFIG');
    const parsed = new URL(url);
    if (parsed.username || parsed.password || parsed.pathname !== '/') fail('project_root_without_credentials_required', 'CONFIG');
  } catch { fail('valid_public_project_configuration_required', 'CONFIG'); }
  if (env.HITORI_SYNC_TEST_A_UID && env.HITORI_SYNC_TEST_A_UID !== EXPECTED_GALLERY_TEST_A_UID) fail('fixed_dedicated_account_a_uid_required', 'CONFIG');
  if (env.HITORI_SYNC_TEST_A_EMAIL.trim().toLowerCase() === env.HITORI_SYNC_TEST_B_EMAIL.trim().toLowerCase()) fail('two_distinct_test_accounts_required', 'CONFIG');
  if (env.HITORI_SYNC_TEST_B_UID && (!/^[a-f0-9-]{36}$/.test(env.HITORI_SYNC_TEST_B_UID) || env.HITORI_SYNC_TEST_B_UID === EXPECTED_GALLERY_TEST_A_UID)) fail('distinct_account_b_uid_required', 'CONFIG');
  return { url, publicKey: env.HITORI_SYNC_TEST_PUBLIC_KEY,
    accountA: { email: env.HITORI_SYNC_TEST_A_EMAIL, password: env.HITORI_SYNC_TEST_A_PASSWORD },
    accountB: { email: env.HITORI_SYNC_TEST_B_EMAIL, password: env.HITORI_SYNC_TEST_B_PASSWORD },
    expectedBUid: env.HITORI_SYNC_TEST_B_UID || '', reportDir: env.REPORT_DIR || env.HITORI_SYNC_TEST_REPORT_DIR || '' };
}

export function galleryTestOwnedPath(owner, resourceId, suffix = '') {
  ensure(owner === EXPECTED_GALLERY_TEST_A_UID && uuidPattern.test(resourceId) && ['', '-thumb', '-probe'].includes(suffix), 'generated_resource_path_guard');
  return `${owner}/${resourceId}${suffix}.png`;
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
// Unique ancillary text preserves the supplied icon pixels and avoids digest collisions with other test runs.
export function markedTestPng(original, marker) {
  const bytes = Buffer.from(original);
  ensure(bytes.length >= 45 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])), 'valid_test_icon_png_required');
  ensure(/^[a-f0-9:-]{1,120}$/.test(marker), 'generated_png_marker_guard');
  let offset = 8, iend = -1;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    ensure(length <= bytes.length - offset - 12, 'valid_test_icon_png_chunks_required');
    if (bytes.toString('ascii', offset + 4, offset + 8) === 'IEND') { iend = offset; break; }
    offset += 12 + length;
  }
  ensure(iend >= 0, 'test_icon_png_end_required');
  const payload = Buffer.from(`hitori-live-check\0${marker}`);
  const chunk = Buffer.alloc(payload.length + 12);
  chunk.writeUInt32BE(payload.length, 0); chunk.write('tEXt', 4); payload.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, 8 + payload.length)), 8 + payload.length);
  return Buffer.concat([bytes.subarray(0, iend), chunk, bytes.subarray(iend)]);
}

export async function runGalleryLivePolicy(env = process.env) {
  const report = { backend: 'real-supabase', status: 'NOT_RUN', liveBackendAttempted: false,
    verified: false, checks: [], cleanup: { attempted: false, complete: false, collections: true, images: true, storage: true, verifiedAbsent: true }, failure: null };
  const cleanupCollections = new Set(), cleanupImages = new Set(), cleanupPaths = new Set();
  const clients = [];
  let config, a, b, anon, ownerReady = false;
  const checkpoint = name => report.checks.push({ name, passed: true });
  let activeStep = 'configuration_guard';
  const step = async (name, action) => { activeStep = name; await action(); checkpoint(name); };
  const serviceFetch = (input, options = {}) => fetch(input, { ...options,
    signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) });
  const localId = () => randomUUID();
  const exactImage = (client, id, fields = '*') => client.from('gallery_uploads').select(fields).eq('id', id);
  const exactCollection = (client, id) => client.from('gallery_collections').select('id,title,cover_image_id,published,sort_order,gallery_collection_items(image_id,sort_order)').eq('id', id);
  const memberIds = row => [...(row.gallery_collection_items || [])].sort((left, right) => left.sort_order - right.sort_order).map(item => item.image_id);
  const trackImage = id => { ensure(uuidPattern.test(id), 'generated_image_id_guard'); cleanupImages.add(id); };
  const trackCollection = id => { ensure(uuidPattern.test(id), 'generated_collection_id_guard'); cleanupCollections.add(id); };
  const trackPath = path => {
    ensure(path.startsWith(`${EXPECTED_GALLERY_TEST_A_UID}/`) && /^([a-f0-9-]{36})(?:-thumb|-probe)?\.png$/.test(path.split('/')[1] || ''), 'generated_cleanup_path_guard');
    cleanupPaths.add(path);
  };
  async function login(client, credentials, expectedUid, name) {
    const response = await client.auth.signInWithPassword(credentials);
    const data = ok(response, name);
    ensure(data?.user?.id && data?.session, name);
    const confirmed = ok(await client.auth.getUser(), name);
    ensure(confirmed?.user?.id === data.user.id && (!expectedUid || data.user.id === expectedUid), name);
    return data.user.id;
  }
  function makeRow(id, bytes, path, thumbnail) {
    return { id, owner_id: EXPECTED_GALLERY_TEST_A_UID, object_path: path, thumbnail_path: thumbnail, preview_path: path,
      title: '隔离验收测试 · 随后自动清理', alt: '一里小屋原创桌面图标，仅用于本次真实后端验收',
      credit: '一里小屋原创图标 · 隔离验收', creator: '一里小屋', source_url: '',
      width: 192, height: 192, category: 'poster', characters: [], tags: ['隔离验收'],
      sort_order: 1000000, published: false, content_sha256: createHash('sha256').update(bytes).digest('hex') };
  }
  async function hiddenFrom(client, id, name) { policyBlocked(await exactImage(client, id, 'id'), name, true); }
  async function ownerImage(id, fields = '*') {
    const rows = ok(await exactImage(a, id, fields), activeStep);
    ensure(rows.length === 1, activeStep); return rows[0];
  }
  async function ownerCollection(id) {
    const rows = ok(await exactCollection(a, id), activeStep);
    ensure(rows.length === 1, activeStep); return rows[0];
  }
  try {
    config = readGalleryLiveConfig(env);
    checkpoint('configuration_and_fixed_account_guard');
    const create = () => {
      const client = createClient(config.url, config.publicKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: serviceFetch } });
      clients.push(client); return client;
    };
    a = create(); b = create(); anon = create(); report.liveBackendAttempted = true;
    let uidA, uidB;
    await step('dedicated_authenticated_account_identities', async () => {
      uidA = await login(a, config.accountA, EXPECTED_GALLERY_TEST_A_UID, activeStep);
      uidB = await login(b, config.accountB, config.expectedBUid, activeStep);
      ensure(uidA !== uidB, activeStep);
    });
    await step('a_whitelisted_b_ordinary_and_test_namespaces_empty', async () => {
      const allowed = ok(await a.from('gallery_admins').select('user_id').eq('user_id', uidA), activeStep);
      const ordinary = ok(await b.from('gallery_admins').select('user_id').eq('user_id', uidB), activeStep);
      ensure(allowed.length === 1 && allowed[0].user_id === uidA && ordinary.length === 0, activeStep);
      const own = ok(await a.from('gallery_uploads').select('id,preview_path,characters,category,tags,creator,source_url,published,sort_order,content_sha256').eq('owner_id', uidA).limit(1), activeStep);
      const ownCollections = ok(await a.from('gallery_collections').select('id').eq('owner_id', uidA).limit(1), activeStep);
      ensure(own.length === 0 && ownCollections.length === 0, activeStep);
      ownerReady = true;
    });
    const run = localId(), image1 = localId(), image2 = localId(), collection1 = localId(), collection2 = localId();
    const icon = await readFile(new URL('../public/icons/hitori-192.png', import.meta.url));
    ensure(icon.readUInt32BE(16) === 192 && icon.readUInt32BE(20) === 192, 'test_icon_dimensions');
    const rows = [];
    await step('real_storage_original_thumbnail_and_private_preview_rows', async () => {
      for (const id of [image1, image2]) {
        const bytes = markedTestPng(icon, `${run}:${id}`), resource = localId();
        const path = galleryTestOwnedPath(uidA, resource), thumbnail = galleryTestOwnedPath(uidA, resource, '-thumb');
        for (const target of [path, thumbnail]) {
          trackPath(target);
          ok(await a.storage.from('gallery-uploads').upload(target, new Blob([bytes], { type: 'image/png' }), { contentType: 'image/png', upsert: false }), activeStep);
        }
        const publicUrl = a.storage.from('gallery-uploads').getPublicUrl(path).data.publicUrl;
        ensure(new URL(publicUrl).origin === new URL(config.url).origin, activeStep);
        const actual = await serviceFetch(publicUrl);
        ensure(actual.ok && Buffer.from(await actual.arrayBuffer()).equals(bytes), activeStep);
        const row = makeRow(id, bytes, path, thumbnail); trackImage(id);
        const inserted = ok(await a.from('gallery_uploads').insert(row).select('id,preview_path,published').single(), activeStep);
        ensure(inserted.id === id && inserted.preview_path === path && inserted.published === false, activeStep);
        rows.push(row);
      }
    });
    await step('new_explicit_metadata_edit_order_and_stable_resource_identity', async () => {
      const changes = { title: '隔离验收测试 · 元数据已编辑', characters: ['hitori','kita'], category: 'illustration',
        tags: ['隔离验收','自动清理'], creator: '一里小屋', source_url: 'https://hitori-gotou1.github.io/patrol-retest-demo/', sort_order: 999999 };
      const edited = ok(await a.from('gallery_uploads').update(changes).eq('id', image1).eq('owner_id', uidA).select('*').single(), activeStep);
      ensure(edited.id === image1 && edited.object_path === rows[0].object_path && edited.thumbnail_path === rows[0].thumbnail_path
        && edited.preview_path === rows[0].object_path && JSON.stringify(edited.characters) === JSON.stringify(changes.characters)
        && JSON.stringify(edited.tags) === JSON.stringify(changes.tags) && edited.category === changes.category && edited.sort_order === changes.sort_order, activeStep);
      const invalid = await a.from('gallery_uploads').update({ tags: ['<invalid>'] }).eq('id', image1).eq('owner_id', uidA);
      ensure(invalid.error?.code === '23514', activeStep);
      ensure(JSON.stringify((await ownerImage(image1, 'id,tags')).tags) === JSON.stringify(changes.tags), activeStep);
    });
    await step('b_and_anonymous_private_read_update_insert_and_storage_isolation', async () => {
      for (const client of [b, anon]) {
        await hiddenFrom(client, image1, activeStep);
        policyBlocked(await client.from('gallery_uploads').update({ title: '禁止的测试修改' }).eq('id', image1).select('id'), activeStep, true);
        const probe = localId(), probeResource = localId(), bytes = markedTestPng(icon, `${run}:${probe}`);
        const path = galleryTestOwnedPath(uidA, probeResource, '-probe'), thumbnail = galleryTestOwnedPath(uidA, localId(), '-thumb');
        trackImage(probe);
        policyBlocked(await client.from('gallery_uploads').insert(makeRow(probe, bytes, path, thumbnail)), activeStep);
        trackPath(path);
        policyBlocked(await client.storage.from('gallery-uploads').upload(path, new Blob([bytes], { type: 'image/png' }), { contentType: 'image/png', upsert: false }), activeStep);
      }
      ensure((await ownerImage(image1, 'id,title')).title === '隔离验收测试 · 元数据已编辑', activeStep);
    });
    const collectionDetails = { title: '隔离验收合集 · 随后自动清理', description: '本次真实后端验收的临时合集，不含访客或站主原有资源。',
      cover_image_id: `cloud-${image1}`, published: false, sort_order: 1000000 };
    const originalMembers = [`cloud-${image1}`, `cloud-${image2}`];
    await step('owner_collection_rpc_multiple_memberships_and_order', async () => {
      for (const [id, members] of [[collection1, originalMembers],[collection2,[`cloud-${image1}`]]]) {
        trackCollection(id);
        const saved = ok(await a.rpc('gallery_save_collection', { collection_id: id, details: collectionDetails, image_ids: members }), activeStep);
        ensure(saved === id, activeStep);
      }
      ensure(JSON.stringify(memberIds(await ownerCollection(collection1))) === JSON.stringify(originalMembers), activeStep);
      ensure(memberIds(await ownerCollection(collection2)).includes(`cloud-${image1}`), activeStep);
      const reordered = [`cloud-${image2}`,`cloud-${image1}`];
      ok(await a.rpc('gallery_save_collection', { collection_id: collection2,
        details: { ...collectionDetails, cover_image_id: `cloud-${image2}`, sort_order: 999998 }, image_ids: reordered }), activeStep);
      ensure(JSON.stringify(memberIds(await ownerCollection(collection2))) === JSON.stringify(reordered), activeStep);
    });
    await step('collection_rpc_invalid_member_rolls_back_title_and_members', async () => {
      const before = await ownerCollection(collection1);
      const invalid = await a.rpc('gallery_save_collection', { collection_id: collection1,
        details: { ...collectionDetails, title: '禁止持久化的事务测试' }, image_ids: [`cloud-${image1}`,`cloud-${localId()}`] });
      ensure(invalid.error?.code === 'P0001', activeStep);
      const after = await ownerCollection(collection1);
      ensure(after.title === before.title && JSON.stringify(memberIds(after)) === JSON.stringify(memberIds(before)), activeStep);
    });
    await step('b_and_anonymous_cannot_read_private_collections_or_mutate_rpc', async () => {
      for (const client of [b, anon]) {
        policyBlocked(await exactCollection(client, collection1), activeStep, true);
        policyBlocked(await client.from('gallery_collection_items').select('image_id').eq('collection_id', collection1), activeStep, true);
        policyBlocked(await client.rpc('gallery_save_collection', { collection_id: collection1,
          details: { ...collectionDetails, title: '禁止的跨账号合集修改' }, image_ids: originalMembers }), activeStep);
      }
      ensure((await ownerCollection(collection1)).title === collectionDetails.title, activeStep);
    });
    await step('brief_publication_public_reads_denied_writes_then_unpublish', async () => {
      try {
        ok(await a.from('gallery_uploads').update({ published: true }).eq('id', image1).eq('owner_id', uidA), activeStep);
        ok(await a.from('gallery_collections').update({ published: true }).eq('id', collection1).eq('owner_id', uidA), activeStep);
        await Promise.all([b, anon].map(async client => {
          const visible = ok(await exactImage(client, image1, 'id,title,characters,tags,category,sort_order,preview_path'), activeStep);
          const collection = ok(await exactCollection(client, collection1), activeStep);
          ensure(visible.length === 1 && visible[0].id === image1 && visible[0].preview_path === rows[0].object_path
            && collection.length === 1 && memberIds(collection[0]).length === 2, activeStep);
          policyBlocked(await client.from('gallery_uploads').update({ title: '禁止的公开图修改' }).eq('id', image1).select('id'), activeStep, true);
          policyBlocked(await client.from('gallery_collections').update({ title: '禁止的公开合集修改' }).eq('id', collection1).select('id'), activeStep, true);
        }));
      } finally {
        // Close the public window immediately, even when an assertion or network request fails.
        const hiding = await Promise.all([
          a.from('gallery_uploads').update({ published: false }).eq('id', image1).eq('owner_id', uidA),
          a.from('gallery_collections').update({ published: false }).eq('id', collection1).eq('owner_id', uidA)
        ]);
        for (const result of hiding) ok(result, activeStep);
      }
      ensure((await ownerImage(image1, 'id,title,published')).published === false
        && (await ownerCollection(collection1)).published === false, activeStep);
      for (const client of [b, anon]) { await hiddenFrom(client, image1, activeStep); policyBlocked(await exactCollection(client, collection1), activeStep, true); }
    });
    report.status = 'PASS'; report.verified = true;
  } catch (error) {
    report.status = report.liveBackendAttempted ? 'FAIL' : 'NOT_RUN';
    report.failure = { check: error instanceof AcceptanceFailure ? error.check : activeStep, code: error instanceof AcceptanceFailure ? error.safeCode : 'SERVICE_ERROR' };
  } finally {
    if (ownerReady && a) {
      report.cleanup.attempted = true;
      // No unqualified/bulk deletes. Every mutation uses one generated ID AND the fixed dedicated owner.
      for (const id of cleanupCollections) {
        try { const result = await a.from('gallery_collections').delete().eq('id', id).eq('owner_id', EXPECTED_GALLERY_TEST_A_UID); if (result.error) report.cleanup.collections = false; }
        catch { report.cleanup.collections = false; }
      }
      for (const id of cleanupImages) {
        try { const result = await a.from('gallery_uploads').delete().eq('id', id).eq('owner_id', EXPECTED_GALLERY_TEST_A_UID); if (result.error) report.cleanup.images = false; }
        catch { report.cleanup.images = false; }
      }
      for (const path of cleanupPaths) {
        try { const result = await a.storage.from('gallery-uploads').remove([path]); if (result.error) report.cleanup.storage = false; }
        catch { report.cleanup.storage = false; }
      }
      for (const [table, ids] of [['gallery_collections', cleanupCollections],['gallery_uploads', cleanupImages]]) {
        for (const id of ids) {
          try { const result = await a.from(table).select('id').eq('id', id).eq('owner_id', EXPECTED_GALLERY_TEST_A_UID); if (result.error || result.data.length) report.cleanup.verifiedAbsent = false; }
          catch { report.cleanup.verifiedAbsent = false; }
        }
      }
      for (const path of cleanupPaths) {
        try {
          const basename = path.split('/')[1];
          const result = await a.storage.from('gallery-uploads').list(EXPECTED_GALLERY_TEST_A_UID, { limit: 10, search: basename });
          if (result.error || result.data.some(item => item.name === basename)) report.cleanup.verifiedAbsent = false;
        } catch { report.cleanup.verifiedAbsent = false; }
      }
      report.cleanup.complete = report.cleanup.collections && report.cleanup.images && report.cleanup.storage && report.cleanup.verifiedAbsent;
      if (!report.cleanup.complete) { report.status = 'FAIL'; report.verified = false; report.failure ||= { check: 'exact_generated_resource_cleanup', code: 'CLEANUP_INCOMPLETE' }; }
    }
    for (const client of clients.slice(0, 2)) { try { await client.auth.signOut({ scope: 'local' }); } catch { /* No stored session exists; do not print authentication responses. */ } }
  }
  // The report intentionally excludes URLs, keys, emails, passwords, tokens, sessions and non-test rows.
  const output = JSON.stringify(report, null, 2) + '\n';
  const reportDir = config?.reportDir || env.REPORT_DIR || env.HITORI_SYNC_TEST_REPORT_DIR;
  if (reportDir) { await mkdir(reportDir, { recursive: true }); await writeFile(join(reportDir, 'gallery-live-policy.json'), output, { mode: 0o600 }); }
  return report;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const report = await runGalleryLivePolicy();
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.status === 'PASS' ? 0 : report.status === 'NOT_RUN' ? 2 : 1;
}
