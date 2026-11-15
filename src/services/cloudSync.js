import { reactive } from 'vue';
import { flushLiveDrafts } from './draftPersistence.js';
import { validateGalleryConfig } from './galleryCloudConfig.js';
import { withCloudDeadline, fetchAuthWithDeadline } from './cloudConnection.js';
import { contentHash, recordKey, validateSyncRecord, describeRecord, reconcileRecord, orderSyncPlans } from './syncCore.js';
import { readSyncSnapshot, snapshotHashes, stageSyncSnapshot, applyStagedSnapshot } from './syncStorage.js';
import { workTypes } from '../room/workshelf.js';
const projectUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const publicKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
export const syncConfigured = validateGalleryConfig(projectUrl, publicKey);
export const syncSettingsKey = 'hitori-room:sync-settings:v1';
const localOwnerKey = 'hitori-room:sync-local-owner:v1';
const stateKey = uid => `hitori-room:sync-state:${uid}:v1`;
const emptyState = () => ({ version: 1, base: {}, observed: {}, outbox: {}, lastSuccess: null, conflicts: [] });
export const syncStatus = reactive({ ready: false, user: null, enabled: false, busy: false, message: '', error: '',
  pending: 0, lastSuccess: null, conflicts: [], switchBlocked: false, preview: null, cloudCount: 0, localCount: 0 });
let clientPromise, accountState, generation = 0, running, captureTimer, pushTimer, polling, started = false, initializing, initializationRetryRegistered = false, applying = false;
function readJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function persistState(uid, state = accountState) {
  if (!uid || !state) return;
  localStorage.setItem(stateKey(uid), JSON.stringify(state));
  if (syncStatus.user?.id !== uid || accountState !== state) return;
  syncStatus.pending = Object.keys(state.outbox).length;
  syncStatus.lastSuccess = state.lastSuccess;
  syncStatus.conflicts = state.conflicts;
}
export async function getSyncClient() {
  if (!syncConfigured) return null;
  if (!clientPromise) clientPromise = import('@supabase/supabase-js').then(({ createClient }) => createClient(projectUrl, publicKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'hitori-room:visitor-session:v1' },
    global: { fetch: (input, options) => String(input instanceof Request ? input.url : input).includes('/auth/v1/')
      ? fetchAuthWithDeadline(input, options) : fetch(input, options) }
  })).catch(error => { clientPromise = undefined; throw error; });
  return clientPromise;
}
function friendlyError(error) {
  if (!navigator.onLine) return '现在离线，修改仍留在本机。联网后会继续同步。';
  if (['42P01', 'PGRST205', 'PGRST202'].includes(error?.code)) return '同步服务尚未配置，请站主执行跨设备同步迁移。';
  if (error?.code === 'CLOUD_TIMEOUT') return '连接同步服务超时，已保留本机修改，可重试。';
  return error?.message || '同步没有完成，本机内容仍保留，可稍后重试。';
}
async function acceptUser(user) {
  generation++;
  clearTimeout(pushTimer);
  syncStatus.user = user ? { id: user.id, email: user.email || '' } : null;
  syncStatus.busy = false; syncStatus.enabled = false; syncStatus.preview = null; syncStatus.conflicts = []; syncStatus.pending = 0;
  if (!user) { accountState = undefined; return; }
  accountState = readJson(stateKey(user.id), emptyState());
  if (accountState.version !== 1 || !accountState.base || !accountState.observed || !accountState.outbox) accountState = emptyState();
  persistState(user.id);
  const preference = readJson(syncSettingsKey, {});
  const localOwner = localStorage.getItem(localOwnerKey);
  syncStatus.switchBlocked = !!localOwner && localOwner !== user.id;
  if (preference.enabled && preference.userId === user.id && !syncStatus.switchBlocked) {
    syncStatus.enabled = true;
    void synchronize();
  }
}
export async function initializeSync() {
  if (!initializationRetryRegistered && typeof window !== 'undefined') {
    initializationRetryRegistered = true;
    window.addEventListener('online', () => {
      if (!started) void initializeSync().catch(error => { syncStatus.error = friendlyError(error); });
      else if (syncStatus.enabled) void synchronize();
    });
  }
  if (started || !syncConfigured) { syncStatus.ready = true; return; }
  // Offline settings remain usable even when the optional Auth SDK was never downloaded.
  if (!navigator.onLine && !clientPromise) {
    syncStatus.ready = true;
    syncStatus.message = '当前离线，本机和已下载玩法继续可用。联网后会重新准备同步连接。';
    return;
  }
  if (initializing) return initializing;
  initializing = (async () => {
  const client = await getSyncClient();
  const { data, error } = await client.auth.getUser();
  if (error && error.name !== 'AuthSessionMissingError') syncStatus.error = friendlyError(error);
  let restoredUser = data.user;
  if (!restoredUser && !navigator.onLine) { const cached = await client.auth.getSession(); restoredUser = cached.data.session?.user || null; }
  await acceptUser(restoredUser);
  client.auth.onAuthStateChange((event, session) => { if (event === 'SIGNED_OUT' || session?.user?.id !== syncStatus.user?.id) void acceptUser(session?.user || null); });
  started = true; syncStatus.ready = true;
  polling = setInterval(() => { if (syncStatus.enabled && !applying) void captureLocalChanges(); }, 2000);
  const resume = () => { if (syncStatus.enabled && navigator.onLine) void synchronize(); };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) resume(); });
  window.addEventListener('storage', event => {
    if (event.key === syncSettingsKey && !applying) {
      const next = readJson(syncSettingsKey, {});
      if (!next.enabled || next.userId !== syncStatus.user?.id) { generation++; syncStatus.enabled = false; clearTimeout(pushTimer); }
    }
  });
  })().finally(() => { initializing = undefined; });
  return initializing;
}
export async function signInForSync(email, password) {
  syncStatus.error = ''; syncStatus.busy = true;
  try {
    const client = await getSyncClient();
    if (!client) throw new Error('站主尚未配置云端连接。');
    const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    await acceptUser(data.user);
    syncStatus.message = '已登录。确认同步范围后，再主动连接。';
  } catch (error) { syncStatus.error = friendlyError(error); throw error; }
  finally { syncStatus.busy = false; }
}
export async function signUpForSync(email, password) {
  const client = await getSyncClient();
  if (!client) throw new Error('站主尚未配置云端连接。');
  const { error } = await client.auth.signUp({ email: email.trim(), password,
    options: { emailRedirectTo: `${location.origin}${import.meta.env.BASE_URL}#/settings/device` } });
  if (error) throw error;
  syncStatus.message = '请查看邮箱完成验证，再回来登录。项目如关闭注册，请向站主申请独立账号。';
}
export async function signOutForSync() {
  const uid = syncStatus.user?.id;
  if (!await disableSync()) return;
  const expectedGeneration = generation, client = await getSyncClient();
  if (generation !== expectedGeneration || syncStatus.user?.id !== uid) return;
  const { error } = await client.auth.signOut({ scope: 'local' });
  if (error) throw error;
  await acceptUser(null);
  syncStatus.message = '已退出。本机作品继续保留，之后的修改仍归属于原账号，避免串号。';
}
export async function disableSync() {
  const uid = syncStatus.user?.id, expectedGeneration = generation;
  if (syncStatus.enabled) await captureLocalChanges(false);
  if (generation !== expectedGeneration || syncStatus.user?.id !== uid) return false;
  generation++; syncStatus.enabled = false; clearTimeout(pushTimer);
  localStorage.setItem(syncSettingsKey, JSON.stringify({ enabled: false, userId: syncStatus.user?.id || '' }));
  syncStatus.message = '已关闭自动同步。本机内容保留；云端内容只有这个账号可以读取。';
  return true;
}
async function fetchRemote(uid, expectedGeneration) {
  const client = await getSyncClient(), records = {};
  return withCloudDeadline(async signal => {
    for (let offset = 0; ; offset += 300) {
      const { data, error } = await client.from('hitori_sync_records').select('space,entity_id,payload,deleted,revision,updated_at,last_operation')
        .eq('owner_id', uid).order('space').order('entity_id').range(offset, offset + 299).abortSignal(signal);
      if (error) throw error;
      if (generation !== expectedGeneration) throw new DOMException('账号已变化', 'AbortError');
      for (const row of data) { const record = validateSyncRecord(row); records[recordKey(record)] = record; }
      if (data.length < 300) return records;
      if (offset >= 6500) throw new Error('云端记录超过同步上限，请联系站主检查。');
    }
  });
}
export async function previewConnection() {
  if (!syncStatus.user) throw new Error('请先登录独立的同步账号。');
  const uid = syncStatus.user.id, currentGeneration = generation;
  syncStatus.busy = true; syncStatus.error = '';
  try {
    const local = readSyncSnapshot(), remote = await fetchRemote(uid, currentGeneration);
    syncStatus.preview = { works: Object.values(local).filter(row => row.space === 'work').length,
      remoteWorks: Object.values(remote).filter(row => row.space === 'work' && !row.deleted).length,
      local: Object.keys(local).length, remote: Object.keys(remote).length, previousOwner: localStorage.getItem(localOwnerKey) || '' };
    return syncStatus.preview;
  } catch (error) { syncStatus.error = friendlyError(error); throw error; }
  finally { syncStatus.busy = false; }
}
export async function enableSync({ switchAccount = false } = {}) {
  if (!syncStatus.user || !syncStatus.preview) throw new Error('请先查看合并预览。');
  const uid = syncStatus.user.id, expectedGeneration = generation;
  await flushLiveDrafts();
  if (generation !== expectedGeneration || syncStatus.user?.id !== uid) throw new DOMException('账号已变化', 'AbortError');
  const owner = localStorage.getItem(localOwnerKey);
  if (owner && owner !== uid) {
    const previous = readJson(stateKey(owner), emptyState());
    const hashes = await snapshotHashes(readSyncSnapshot());
    if (generation !== expectedGeneration || syncStatus.user?.id !== uid) throw new DOMException('账号已变化', 'AbortError');
    const unchanged = JSON.stringify(Object.entries(hashes).sort()) === JSON.stringify(Object.entries(previous.observed || {}).sort());
    if (!switchAccount || !previous.lastSuccess || !unchanged || Object.keys(previous.outbox || {}).length || previous.conflicts?.length) {
      throw new Error('本机仍有关联上个账号的内容。请先登录原账号完成同步；确认全部保存后，才能切换，避免将内容混入新账号。');
    }
    const remote = await fetchRemote(uid, expectedGeneration);
    // Validation and quota checks happen before any local content changes.
    const emptyStore = { getItem: () => null };
    const staged = stageSyncSnapshot(remote, emptyStore), switchedState = emptyState();
    for (const [key, row] of Object.entries(remote)) {
      const description = await describeRecord(row);
      if (generation !== expectedGeneration || syncStatus.user?.id !== uid) throw new DOMException('账号已变化', 'AbortError');
      switchedState.base[key] = description;
    }
    if (generation !== expectedGeneration || syncStatus.user?.id !== uid) throw new DOMException('账号已变化', 'AbortError');
    applyStagedSnapshot(staged);
    localStorage.setItem(localOwnerKey, uid);
    const switchedHashes = await snapshotHashes(readSyncSnapshot());
    if (generation !== expectedGeneration || syncStatus.user?.id !== uid) throw new DOMException('账号已变化', 'AbortError');
    switchedState.observed = switchedHashes; accountState = switchedState;
  }
  if (generation !== expectedGeneration || syncStatus.user?.id !== uid) throw new DOMException('账号已变化', 'AbortError');
  localStorage.setItem(localOwnerKey, uid);
  localStorage.setItem(syncSettingsKey, JSON.stringify({ enabled: true, userId: uid }));
  syncStatus.enabled = true; syncStatus.switchBlocked = false; syncStatus.preview = null;
  persistState(uid);
  await synchronize();
}
export async function captureLocalChanges(schedule = true) {
  if (!syncStatus.enabled || !syncStatus.user || applying || !accountState) return;
  const captureUid = syncStatus.user.id, captureGeneration = generation, capturedState = accountState;
  clearTimeout(captureTimer);
  try {
    const local = readSyncSnapshot(), hashes = await snapshotHashes(local);
    if (captureGeneration !== generation || syncStatus.user?.id !== captureUid || accountState !== capturedState) return;
    for (const key of new Set([...Object.keys(hashes), ...Object.keys(accountState.observed)])) {
      if (hashes[key] === accountState.observed[key]) continue;
      const [space, ...id] = key.split(':');
      const row = local[key];
      accountState.outbox[key] = { space, entity_id: id.join(':'), payload: row?.payload ?? null, deleted: !row,
        operation: crypto.randomUUID(), changedAt: Date.now() };
    }
    // Durable local intent exists before the first network request.
    accountState.observed = hashes;
    persistState(syncStatus.user.id);
    if (schedule && Object.keys(accountState.outbox).length && navigator.onLine && !running) {
      clearTimeout(pushTimer); pushTimer = setTimeout(() => void synchronize(), 700);
    }
  } catch (error) { syncStatus.error = friendlyError(error); }
}
async function putRecord(uid, key, choice, expectedGeneration, capturedState) {
  const ensure = () => { if (generation !== expectedGeneration || syncStatus.user?.id !== uid || accountState !== capturedState || !syncStatus.enabled) throw new DOMException('账号已变化', 'AbortError'); };
  ensure();
  const client = await getSyncClient(); ensure();
  const pending = capturedState.outbox[key] || { operation: crypto.randomUUID() };
  capturedState.outbox[key] = { ...pending, ...choice }; persistState(uid, capturedState);
  const { data: sessionData, error: sessionError } = await client.auth.getSession(); ensure();
  if (sessionError) throw sessionError;
  if (sessionData.session?.user?.id !== uid) throw new DOMException('账号已变化', 'AbortError');
  // Freeze the authenticated token; no old payload can use a new account's token.
  const data = await withCloudDeadline(async signal => {
    ensure();
    const response = await fetch(`${projectUrl}/rest/v1/rpc/hitori_sync_put`, { method: 'POST', signal,
      headers: { apikey: publicKey, Authorization: `Bearer ${sessionData.session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_space: choice.space, p_entity_id: choice.entity_id, p_payload: choice.deleted ? null : choice.payload,
        p_deleted: choice.deleted, p_expected_revision: choice.expected, p_operation: pending.operation }) });
    const body = await response.json(); ensure();
    if (!response.ok) throw Object.assign(new Error(body.message || '同步提交失败。'), { code: body.code, status: response.status });
    return body;
  });
  ensure();
  if (!data?.accepted) return { conflict: validateSyncRecord(data.record) };
  const row = validateSyncRecord(data.record), description = await describeRecord(row); ensure();
  capturedState.base[key] = description; delete capturedState.outbox[key]; persistState(uid, capturedState);
  return { row };
}
export async function synchronize() {
  if (!syncStatus.enabled || !syncStatus.user) return;
  if (running) return running;
  const uid = syncStatus.user.id, currentGeneration = generation, runState = accountState;
  const ensure = () => { if (generation !== currentGeneration || syncStatus.user?.id !== uid || accountState !== runState || !syncStatus.enabled) throw new DOMException('账号已变化', 'AbortError'); };
  running = (async () => {
    syncStatus.busy = true; syncStatus.error = ''; syncStatus.message = '正在核对本机与云端的每份记录…';
    try {
      if (!navigator.onLine) throw new Error('offline');
      await flushLiveDrafts(); ensure();
      await captureLocalChanges(false); ensure();
      if (syncStatus.error) throw new Error(syncStatus.error);
      const local = readSyncSnapshot(), localBefore = await snapshotHashes(local), remote = await fetchRemote(uid, currentGeneration); ensure();
      const merged = { ...local }, plans = [], conflicts = [];
      for (const key of new Set([...Object.keys(local), ...Object.keys(remote), ...Object.keys(runState.base), ...Object.keys(runState.outbox)])) {
        const localRow = local[key], remoteRow = remote[key], base = runState.base[key];
        const plan = await reconcileRecord({ local: localRow, remote: remoteRow, base, firstConnection: !runState.lastSuccess }); ensure();
        if (plan.action === 'conflict') { conflicts.push({ key, local: localRow || null, remote: remoteRow }); continue; }
        if (plan.action === 'push') {
          const descriptor = localRow || remoteRow || runState.outbox[key];
          if (!descriptor) continue;
          merged[key] = { ...descriptor, payload: plan.payload, deleted: plan.deleted };
          plans.push({ key, ...descriptor, ...plan });
        } else if (['pull', 'same'].includes(plan.action)) merged[key] = remoteRow;
      }
      if (conflicts.length) {
        runState.conflicts = conflicts; persistState(uid, runState);
        syncStatus.message = `有 ${conflicts.length} 处同时修改。两份内容均保留，选择后再同步。`;
        return;
      }
      // Validate every incoming record and enforce existing capacity before mutating either side.
      stageSyncSnapshot(merged);
      for (const plan of orderSyncPlans(plans)) {
        const result = await putRecord(uid, plan.key, plan, currentGeneration, runState); ensure();
        if (result.conflict) {
          runState.conflicts = [{ key: plan.key, local: local[plan.key] || null, remote: result.conflict }];
          persistState(uid, runState); syncStatus.message = '同步期间另一台设备有新修改，请先处理冲突。'; return;
        }
        merged[plan.key] = result.row;
      }
      if (generation !== currentGeneration || syncStatus.user?.id !== uid || !syncStatus.enabled) return;
      await flushLiveDrafts(); ensure();
      const nowHashes = await snapshotHashes(readSyncSnapshot()); ensure();
      if (JSON.stringify(Object.entries(nowHashes).sort()) !== JSON.stringify(Object.entries(localBefore).sort())) {
        syncStatus.message = '本机刚有新修改，已保留，正在重新合并。';
        setTimeout(() => void synchronize(), 900); return;
      }
      applying = true;
      applyStagedSnapshot(stageSyncSnapshot(merged));
      const finalHashes = await snapshotHashes(readSyncSnapshot()); ensure();
      runState.observed = finalHashes;
      for (const [key, row] of Object.entries(merged)) {
        if (row.revision) { const description = await describeRecord(row); ensure(); runState.base[key] = description; }
      }
      runState.conflicts = []; runState.outbox = {}; runState.lastSuccess = new Date().toISOString();
      persistState(uid, runState);
      syncStatus.message = '已同步。作品版本、草稿与删除记录分别核对，原有作品架限制继续生效。';
    } catch (error) {
      if (error?.name !== 'AbortError' && generation === currentGeneration && accountState === runState) syncStatus.error = friendlyError(error);
    } finally { applying = false; if (generation === currentGeneration && accountState === runState) syncStatus.busy = false; running = undefined; if (generation !== currentGeneration && syncStatus.enabled && syncStatus.user) queueMicrotask(() => void synchronize()); }
  })();
  return running;
}
export async function resolveSyncConflict(key, choice) {
  const uid = syncStatus.user?.id, expectedGeneration = generation, resolutionState = accountState;
  const ensure = () => { if (generation !== expectedGeneration || syncStatus.user?.id !== uid || accountState !== resolutionState) throw new DOMException('账号已变化', 'AbortError'); };
  const conflict = resolutionState?.conflicts.find(item => item.key === key);
  if (!conflict || !syncStatus.user) return;
  await flushLiveDrafts(); ensure();
  const { local, remote } = conflict;
  if (!['local', 'remote', 'both'].includes(choice)) throw new Error('请选择冲突处理方式。');
  if (choice === 'both') {
    const space = remote.space;
    if (!['work', 'draft'].includes(space) || !local || remote.deleted) throw new Error('这份冲突不适合保留为两个作品版本。');
    const payload = space === 'work' ? remote.payload : { id: `sync-${crypto.randomUUID()}`, kind: remote.entity_id,
      at: Date.now(), snapshot: workTypes[remote.entity_id].validate(remote.payload), title: '来自另一台设备的草稿', preview: '', tags: [], pinned: false };
    const copy = { ...payload, id: `sync-${crypto.randomUUID()}`, title: `${payload.title} · 云端版本`.slice(0, 90) };
    const records = readSyncSnapshot(); records[`work:${copy.id}`] = { space: 'work', entity_id: copy.id, payload: copy };
    applying = true;
    try { applyStagedSnapshot(stageSyncSnapshot(records)); } finally { applying = false; }
  }
  if (choice === 'remote') {
    const records = readSyncSnapshot(); records[key] = remote;
    applying = true;
    try { applyStagedSnapshot(stageSyncSnapshot(records)); } finally { applying = false; }
  }
  const description = await describeRecord(remote); ensure();
  resolutionState.base[key] = description;
  resolutionState.conflicts = resolutionState.conflicts.filter(item => item.key !== key);
  // 'local' means an explicit revision-checked edit, never an unconditional upsert.
  if (choice !== 'remote') delete resolutionState.observed[key];
  persistState(uid, resolutionState);
  if (!resolutionState.conflicts.length) await synchronize();
}
