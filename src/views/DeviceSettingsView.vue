<script setup>
import { computed, onMounted, ref } from 'vue';
import { deviceState, startDeviceServices, installDeviceApp, offlineStatus, cacheOfflineSelection, clearOfflineCache,
  checkDeviceUpdate, acceptDeviceUpdate } from '../services/deviceServices.js';
import { syncStatus, syncConfigured, initializeSync, signInForSync, signUpForSync, signOutForSync, disableSync,
  previewConnection, enableSync, synchronize, resolveSyncConflict } from '../services/cloudSync.js';
const offline = ref(null), selected = ref([]), busy = ref(false), notice = ref(''), failure = ref('');
const offlineUnavailable = ref(''), offlineFeedback = ref('');
const email = ref(''), password = ref(''), consent = ref(false), switching = ref(false);
const bytes = value => value >= 1048576 ? `${(value / 1048576).toFixed(2)} MiB` : `${Math.ceil((value || 0) / 1024)} KiB`;
const selectedBytes = computed(() => {
  const manifest = offline.value?.manifest;
  if (!manifest?.fileBytes) return null;
  const files = new Set([...manifest.core, ...selected.value.flatMap(id => manifest.groups[id]?.files || [])]);
  let total = 0;
  for (const file of files) total += manifest.fileBytes[file];
  return total;
});
const descriptions = { work: '作品版本', draft: '创作草稿', favorite: '图片收藏', activity: '常用活动', practice: '练琴记录', rhythm: '节奏最高分' };
async function run(action, feedback = '') {
  if (busy.value) return;
  busy.value = true; offlineFeedback.value = feedback; failure.value = ''; notice.value = '';
  try { await action(); } catch (error) { failure.value = error.message || '操作未完成，请重试。'; }
  finally { busy.value = false; }
}
async function refreshOffline() {
  offline.value = await offlineStatus(); selected.value = [...(offline.value.groups || [])];
}
function saveSelection() {
  return run(async () => {
    await cacheOfflineSelection(selected.value);
    await refreshOffline();
    notice.value = '所选玩法已完整下载。可以先断网，再打开下方入口试试。';
  }, 'selection');
}
function cleanSelection() {
  return run(async () => {
    await clearOfflineCache();
    await refreshOffline();
    notice.value = '离线资源已清理，作品和草稿保留。';
  }, 'maintenance');
}
function inspectOffline() {
  return run(async () => {
    await checkDeviceUpdate();
    offline.value = await offlineStatus();
    notice.value = deviceState.updateAvailable ? '新版本已准备好，保存编辑后可以更新。' : '已检查更新。若后台下载新版本，准备好后这里会提示。';
  }, 'maintenance');
}
onMounted(async () => {
  await startDeviceServices();
  try { await initializeSync(); } catch { syncStatus.error = '同步连接暂未准备好，本机内容和离线入口仍可使用。联网后会自动重试。'; }
  try { await refreshOffline(); } catch (error) { offlineUnavailable.value = error.message; }
});
function reload() { location.reload(); }
function readableConflict(item) { return item.local?.payload?.title || item.local?.payload?.name || item.remote?.payload?.title || item.remote?.payload?.name || item.remote.entity_id; }
</script>
<template>
  <main id="main" class="device-page" tabindex="-1">
    <header><RouterLink to="/room/play">← 回到活动室</RouterLink><p class="device-kicker">把小屋带在身边</p><h1>设备、离线与同步</h1><p>本机创作始终可以使用。下载常用玩法、登录同步，都由你自己选择。</p></header>
    <p class="device-network" role="status">{{deviceState.online ? '● 当前在线' : '○ 当前离线 · 作品和草稿继续保存在本机'}}</p>
    <section aria-labelledby="install-title"><h2 id="install-title">把小屋放到桌面</h2>
      <p v-if="deviceState.installed">小屋已经以独立窗口打开。关闭窗口后，可以从桌面图标回来。</p>
      <button v-else-if="deviceState.canInstall" type="button" :disabled="deviceState.installing" @click="run(async()=>{await installDeviceApp()})">{{deviceState.installing?'正在打开安装提示…':'安装一里小屋'}}</button>
      <p v-else>打开浏览器菜单，选择「添加到主屏幕」或「安装应用」。iPhone / iPad 可在 Safari 的分享菜单中添加；没有这个菜单也可以继续用网页。</p>
      <p class="device-hint">安装图标不会自动下载图库或大型媒体。</p>
    </section>
    <section class="offline-section" aria-labelledby="offline-title">
      <header class="offline-heading">
        <h2 id="offline-title">选几件常用玩法，离线也能继续</h2>
        <div v-if="offline" class="offline-list-heading">
          <h3 id="offline-choice-title">可离线使用的玩法</h3>
          <output class="offline-total" aria-live="polite">预计下载 <strong>{{ selectedBytes === null ? '更新后可估算' : bytes(selectedBytes) }}</strong></output>
        </div>
      </header>
      <div v-if="offline" class="offline-pack">
        <div class="offline-selection">
          <fieldset class="offline-choices" aria-labelledby="offline-choice-title" aria-describedby="offline-size-note" :disabled="busy">
            <label v-for="(group, id) in offline.manifest.groups" :key="id">
              <input v-model="selected" type="checkbox" :value="id">
              <strong>{{ group.title }}</strong>
              <span class="offline-size">约 {{ bytes(group.bytes) }}</span>
            </label>
          </fieldset>
          <p id="offline-size-note" class="device-hint">总量包含必要页面，共享资源只计一次。</p>
          <button type="button" class="offline-primary" :disabled="busy || !deviceState.online" @click="saveSelection">{{ busy && deviceState.progress ? '正在保存…' : '保存所选玩法到此设备' }}</button>
          <progress v-if="deviceState.progress" :value="deviceState.progress.done" :max="deviceState.progress.total" :aria-label="`已保存${deviceState.progress.done}个资源`"></progress>
          <p v-if="offlineFeedback === 'selection' && notice" class="device-callout" role="status">{{ notice }}</p>
          <p v-if="offlineFeedback === 'selection' && failure" class="device-error" role="alert">{{ failure }}</p>
          <nav v-if="offline.enabled && offline.groups.length" class="offline-links" aria-label="已下载的玩法"><RouterLink v-for="id in offline.groups" :key="id" :to="offline.manifest.groups[id].path">✓ {{ offline.manifest.groups[id].title }} ↗</RouterLink></nav>
        </div>
        <div class="offline-maintenance" role="group" aria-label="离线维护">
          <div class="device-actions">
            <button type="button" :disabled="busy || !deviceState.online" @click="inspectOffline">检查版本更新</button>
            <button type="button" :disabled="busy" @click="cleanSelection">清理离线资源</button>
          </div>
          <p class="offline-cached">已缓存 {{ bytes(offline.bytes) }} · {{ offline.count }} 个资源</p>
          <p class="device-hint">清理会移除下载的网页资源，作品、草稿和练习记录会保留。</p>
          <p v-if="offlineFeedback === 'maintenance' && notice" class="device-callout" role="status">{{ notice }}</p>
          <p v-if="offlineFeedback === 'maintenance' && failure" class="device-error" role="alert">{{ failure }}</p>
        </div>
      </div>
      <div class="offline-notes">
        <p v-if="!offline" role="status">{{ deviceState.error || offlineUnavailable || '离线缓存需在生产构建、HTTPS 或本机预览中使用。' }}</p>
        <p v-else-if="!offline.enabled || !offline.groups.length" class="device-hint">还没有下载玩法。勾选后点「保存」，下次离线就能继续。</p>
        <p class="device-hint">只下载你勾选的玩法和必要页面。图库、云端图片、登录、同步与网络内容仍需要联网；离线打开未下载的页面时，请返回这里选择已保存的入口。</p>
        <div v-if="deviceState.updateAvailable" class="device-callout"><p>新版本及已选择的离线资源已准备好。先保存正在编辑的内容，再刷新更新。</p><button type="button" @click="run(acceptDeviceUpdate, 'maintenance')">保存完成，刷新到新版本</button></div>
        <p v-if="deviceState.changedVersion">新版本已接管。<button type="button" @click="reload">刷新使用新版本</button></p>
      </div>
    </section>
    <section aria-labelledby="sync-title"><h2 id="sync-title">在另一台设备接着做</h2>
      <p>可选同步范围：作品架中保存的版本、各创作工具草稿、图片收藏、常用活动及顺序、最近 365 条练琴记录、三档节奏最高分。正在运行的计时器、私人视频、图库原图和其他游戏进度不参与同步。</p>
      <p class="device-hint">作品架仍为 24 个版本、总计 3 MiB。云端合并超过现有限制时会停止，先在作品架整理后再重试。同步不会生成全站备份文件。</p>
      <p v-if="!syncConfigured" class="device-callout">站主尚未配置同步服务。本机功能完整保留；需配置 Supabase 公开连接、执行同步迁移并启用独立用户认证后，才能真实连接。</p>
      <template v-else>
        <form v-if="!syncStatus.user" class="device-login" @submit.prevent="run(async()=>{await signInForSync(email,password);password=''})">
          <p>同步账号与站主管理登录分别保存。请使用你自己的邮箱账号。</p>
          <label>邮箱<input v-model="email" type="email" autocomplete="username" required maxlength="254"></label>
          <label>密码<input v-model="password" type="password" autocomplete="current-password" required minlength="8" maxlength="200"></label>
          <div class="device-actions"><button type="submit" :disabled="busy||syncStatus.busy">登录同步账号</button><button type="button" :disabled="busy||syncStatus.busy||!email||password.length<8" @click="run(async()=>{await signUpForSync(email,password);password=''})">申请账号 / 验证邮箱</button></div>
        </form>
        <template v-else>
          <p class="device-account">当前账号：{{syncStatus.user.email}} · {{syncStatus.enabled?'同步已启用':'同步尚未启用'}}</p>
          <dl class="device-status"><div><dt>状态</dt><dd>{{syncStatus.busy?'正在同步':!deviceState.online?'离线，待联网后继续':syncStatus.conflicts.length?'有冲突待处理':syncStatus.enabled?'等待修改 / 已就绪':'本机使用'}}</dd></div><div><dt>待发送</dt><dd>{{syncStatus.pending}} 条记录</dd></div><div><dt>最近成功</dt><dd>{{syncStatus.lastSuccess?new Date(syncStatus.lastSuccess).toLocaleString('zh-CN'):'尚未成功同步'}}</dd></div></dl>
          <div v-if="!syncStatus.enabled" class="device-merge"><label class="device-consent"><input v-model="consent" type="checkbox">我希望将上述范围同步到自己的账号，首次连接先合并本机与云端。</label><button type="button" :disabled="busy||syncStatus.busy||!consent||!deviceState.online" @click="run(previewConnection)">先查看合并预览</button>
            <div v-if="syncStatus.preview" class="device-callout"><p>本机 {{syncStatus.preview.works}} 个作品版本 / {{syncStatus.preview.local}} 条支持记录；云端 {{syncStatus.preview.remoteWorks}} 个作品版本 / {{syncStatus.preview.remote}} 条记录（含删除标记）。相同编号分别核对；同时修改会请你决定。</p>
              <label v-if="syncStatus.switchBlocked" class="device-consent"><input v-model="switching" type="checkbox">切换到此账号的内容。本机上个账号必须已经成功同步且没有新修改，否则系统会阻止切换。</label>
              <button type="button" :disabled="busy||syncStatus.busy||(syncStatus.switchBlocked&&!switching)" @click="run(()=>enableSync({switchAccount:switching}))">确认连接并合并</button></div>
          </div>
          <div class="device-actions"><button v-if="syncStatus.enabled" type="button" :disabled="busy||syncStatus.busy||!deviceState.online" @click="run(synchronize)">立即同步 / 失败重试</button><button v-if="syncStatus.enabled" type="button" :disabled="busy||syncStatus.busy" @click="run(disableSync)">关闭自动同步</button><button type="button" :disabled="busy||syncStatus.busy" @click="run(signOutForSync)">退出同步账号</button></div>
          <div v-if="syncStatus.conflicts.length" class="device-conflicts"><h3>两台设备都改过，先留住两份内容</h3><p>没有自动覆盖。保留本机会按云端最新修订重新提交；选云端会替换这一条本机记录。作品或草稿可将云端另存为作品版本，仍遵守作品架限制。</p>
            <article v-for="item in syncStatus.conflicts" :key="item.key"><h4>{{descriptions[item.remote.space]}} · {{readableConflict(item)}}</h4><p>本机：{{item.local?'有内容':'已删除'}} · 云端：{{item.remote.deleted?'已删除':'有新修订'}}</p><div class="device-actions"><button type="button" :disabled="busy" @click="run(()=>resolveSyncConflict(item.key,'local'))">保留本机</button><button type="button" :disabled="busy" @click="run(()=>resolveSyncConflict(item.key,'remote'))">采用云端</button><button v-if="['work','draft'].includes(item.remote.space)&&item.local&&!item.remote.deleted" type="button" :disabled="busy" @click="run(()=>resolveSyncConflict(item.key,'both'))">保留本机，云端另存版本</button></div></article>
          </div>
          <p class="device-hint">退出或关闭同步会保留本机内容。之后的修改仍关联原账号；切换账号须先同步完毕，防止把上个账号的作品传给新账号。</p>
        </template>
      </template>
      <p v-if="syncStatus.message" role="status">{{syncStatus.message}}</p><p v-if="syncStatus.error" class="device-error" role="alert">{{syncStatus.error}}</p>
    </section>
    <p v-if="!offlineFeedback && notice" class="device-callout" role="status">{{notice}}</p><p v-if="!offlineFeedback && failure" class="device-error" role="alert">{{failure}}</p>
  </main>
</template>
<style scoped>
.device-page .offline-section { --offline-padding:clamp(14px,2.5vw,28px); padding:0; }
.offline-heading { padding:12px var(--offline-padding); background:#f2e6d8; color:#4f354b; border-bottom:1px solid #9e818c; border-radius:9px 9px 0 0; }
.device-page .offline-heading h2 { margin:0; font:700 clamp(1.175rem,3.5vw,1.45rem)/1.45 var(--room-serif,serif); color:inherit; }
.offline-list-heading { display:flex; flex-wrap:wrap; align-items:baseline; justify-content:space-between; gap:1px 12px; margin-top:3px; }
.offline-list-heading h3 { margin:0; font-size:.875rem; }
.offline-total { color:#67475c; font-size:.8125rem; }
.offline-total strong { color:#4f354b; font:700 1rem var(--mono); font-variant-numeric:tabular-nums; }
.offline-pack { display:grid; grid-template-columns:minmax(0,1fr) minmax(13rem,.52fr); align-items:start; gap:clamp(12px,3vw,30px); padding:12px var(--offline-padding) 0; }
#offline-size-note { margin:7px 0 0; font-size:.8125rem; }
.offline-choices { min-width:0; margin:0; padding:0; border:0; border-top:1px solid #735d74; background:#28212e; }
.offline-choices label { display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:clamp(6px,2vw,12px); min-height:44px; padding:4px 8px; border-bottom:1px solid #56475a; cursor:pointer; }
.device-page .offline-choices input[type=checkbox] { width:20px; height:20px; margin:0; }
.offline-choices label strong,.offline-size { font-size:.875rem; }
.offline-choices label strong { font-weight:550; }
.offline-choices label:has(:checked) { background:#49374a; color:#fff4eb; }
.offline-size { color:#e0c9db; text-align:end; font-variant-numeric:tabular-nums; white-space:nowrap; }
.device-page .offline-primary { margin-top:8px; background:#efd0de; color:#3a2339; border-color:#efd0de; font-weight:700; }
.offline-selection progress { display:block; margin-top:10px; }
.offline-maintenance { padding:12px; border-top:1px solid #735d74; background:#29222f; }
.offline-cached { font-size:.875rem; margin:4px 0; font-variant-numeric:tabular-nums; }
.offline-maintenance .device-actions { gap:6px; margin:0; }
.offline-maintenance .device-actions button { font-size:.875rem; padding:6px 9px; }
.offline-maintenance .device-hint { margin:0; }
.offline-notes { padding:0 var(--offline-padding) 12px; }
.offline-notes p { font-size:.875rem; line-height:1.65; margin:8px 0; }
@media(max-width:760px) {
  .offline-pack { grid-template-columns:minmax(0,1fr); }
  .device-page .offline-primary { width:100%; }
  .offline-maintenance { padding:0; background:transparent; }
  .offline-maintenance .device-actions button { flex:0 1 auto; padding:4px 8px; border:0; background:transparent; text-decoration:underline; text-underline-offset:3px; }
}
.device-page{max-width:1040px;margin:auto;padding:140px 28px 80px;color:#f5e6dc;line-height:1.85;overflow-wrap:anywhere}.device-page header>a{color:#e1b5d0}.device-kicker{color:#d7b2d2;letter-spacing:.15em}.device-page h1{font-size:clamp(1.8rem,4vw,2.8rem);line-height:1.4}.device-page h2{font-size:1.35rem;color:#efd3df}.device-page section{margin:28px 0;padding:28px;border:1px solid #705b71;background:#312936;border-radius:10px}.device-hint,.device-page small{font-size:.9rem;color:#d0bfce}.device-page button,.device-page input{font:inherit}.device-page button,.offline-links a{min-height:44px;padding:10px 16px;border:1px solid #d0a6c2;background:#514052;color:#fff0e8;border-radius:5px;cursor:pointer}.device-page button:disabled{opacity:.5;cursor:default}.device-page :focus-visible{outline:3px solid #edcf85;outline-offset:4px}.device-actions{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0}.device-consent{display:flex;gap:12px;align-items:center;padding:12px;border:1px solid #826982;border-radius:5px;cursor:pointer;min-height:44px}.device-page input[type=checkbox]{width:24px;height:24px;flex-shrink:0;accent-color:#d994b3}.device-page input:not([type=checkbox]){display:block;box-sizing:border-box;width:100%;min-height:46px;padding:8px 12px;background:#211b27;border:1px solid #b393ae;color:#fff0e8;border-radius:4px}.device-login{max-width:530px}.device-login>label{display:block;margin:14px 0}.device-callout{padding:16px;background:#49394b;border-left:3px solid #edcf85}.device-error{color:#ffc6d1;padding:12px;border:1px solid #b66c85}.offline-links{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}.offline-links a{display:inline-flex;align-items:center;text-decoration:none}.device-status{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.device-status div{background:#25202b;padding:12px}.device-status dt{font-size:.85rem;color:#c6b3c3}.device-status dd{margin:4px 0}.device-account{color:#edcf85}.device-conflicts article{padding:18px;margin:14px 0;border:1px solid #bc93ad}.device-page progress{width:100%;height:16px;accent-color:#d994b3}.device-network{font-size:.9rem;color:#d8c5db}@media(max-width:600px){.device-page{padding:120px 16px 40px}.device-page section{padding:18px 14px}.device-status{grid-template-columns:1fr}.device-actions button{flex:1 1 135px}.device-page{padding-bottom:calc(40px + env(safe-area-inset-bottom))}}
</style>
