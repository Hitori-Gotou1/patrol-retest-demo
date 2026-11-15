<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { cloudConfigured, getCloudClient, isGalleryAdmin } from '../services/galleryCloud.js';
import { cloudServiceMessage, withCloudDeadline } from '../services/cloudConnection.js';
import GalleryUploadQueue from '../components/gallery/GalleryUploadQueue.vue';
import GalleryWorkbench from '../components/gallery/GalleryWorkbench.vue';
import GalleryCollectionManager from '../components/gallery/GalleryCollectionManager.vue';

const activeAdminTab = ref('upload');
const queueRef = ref(null);
const session = ref(null);
const checking = ref(cloudConfigured);
const connectionFailed = ref(false);
const admin = ref(false);
const authBusy = ref(false);
const uploading = ref(false);
const email = ref('');
const password = ref('');
const message = ref('');
const error = ref('');
let client;
let subscription;
let alive = true;
let authTimer;
let sessionRevision = 0;

function setSession(nextSession) {
  if (session.value?.user?.id !== nextSession?.user?.id) {
    activeAdminTab.value = 'upload';
  }
  session.value = nextSession;
}
async function syncSession(nextSession) {
  const revision = ++sessionRevision;
  setSession(nextSession);
  admin.value = false;
  checking.value = Boolean(nextSession);
  connectionFailed.value = false;
  if (!nextSession) return;
  try {
    const allowed = await withCloudDeadline(signal => isGalleryAdmin(signal));
    if (alive && revision === sessionRevision) admin.value = allowed;
  } catch (cause) {
    if (alive && revision === sessionRevision) {
      connectionFailed.value = true;
      error.value = `暂时无法确认上传权限。${cloudServiceMessage(cause)}`;
    }
  } finally {
    if (alive && revision === sessionRevision) checking.value = false;
  }
}
function subscribeToSession() {
  if (subscription) return;
  // Never await an API inside the SDK callback: it can hold the session lock.
  subscription = client.auth.onAuthStateChange((event, nextSession) => {
    if (event === 'INITIAL_SESSION') return; // checkSession owns initial recovery.
    if (event === 'TOKEN_REFRESHED' && session.value?.user?.id === nextSession?.user?.id && !connectionFailed.value) return;
    clearTimeout(authTimer);
    authTimer = setTimeout(() => { if (alive) syncSession(nextSession); }, 0);
  }).data.subscription;
}
async function checkSession() {
  const revision = ++sessionRevision;
  checking.value = true;
  connectionFailed.value = false;
  admin.value = false;
  error.value = '';
  try {
    const allowed = await withCloudDeadline(async signal => {
      const connection = await getCloudClient();
      if (!alive || revision !== sessionRevision || signal.aborted) return false;
      client = connection;
      if (!client) return false;
      const { data, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      if (!alive || revision !== sessionRevision || signal.aborted) return false;
      setSession(data.session);
      // Subscribe after SDK recovery: its recovery SIGNED_IN event must not
      // start a second permission check and restart the initial deadline.
      subscribeToSession();
      return data.session ? isGalleryAdmin(signal) : false;
    });
    if (alive && revision === sessionRevision) admin.value = allowed;
  } catch (cause) {
    if (alive && revision === sessionRevision) {
      connectionFailed.value = true;
      error.value = `暂时无法确认登录状态。${cloudServiceMessage(cause)}可重新检查，已有收藏不受影响。`;
    }
  } finally {
    if (alive && revision === sessionRevision) checking.value = false;
  }
}
async function login() {
  if (authBusy.value || !client) return;
  authBusy.value = true;
  error.value = '';
  message.value = '';
  try {
    const result = await withCloudDeadline(() => client.auth.signInWithPassword({ email: email.value.trim(), password: password.value }));
    if (result.error) throw result.error;
    if (alive) {
      password.value = '';
      await syncSession(result.data.session);
    }
  } catch (cause) {
    if (alive) error.value = cause?.code === 'email_not_confirmed' ? '请先完成邮箱验证，再登录。'
      : cause?.code === 'CLOUD_TIMEOUT' ? cloudServiceMessage(cause) : '登录失败，请检查邮箱、密码及网络连接。';
  } finally {
    if (alive) authBusy.value = false;
  }
}
async function logout() {
  if (authBusy.value || uploading.value || !client) return;
  if (queueRef.value?.hasUnfinished() && !window.confirm('队列里还有未完成图片。退出会丢失本次队列，确定退出吗？')) return;
  authBusy.value = true;
  error.value = '';
  try {
    const result = await withCloudDeadline(() => client.auth.signOut());
    if (result.error) throw result.error;
    if (alive) {
      await syncSession(null);
      message.value = '已退出登录。';
    }
  } catch {
    if (alive) error.value = '退出失败，请检查网络后重试。';
  } finally {
    if (alive) authBusy.value = false;
  }
}
function beforeUnload(event) {
  if (!uploading.value) return;
  event.preventDefault();
  event.returnValue = '';
}
onBeforeRouteLeave(() => (!uploading.value && !queueRef.value?.hasUnfinished()) || window.confirm('仍有等待或正在处理的图片任务。离开会丢失未完成队列，确定离开吗？'));
onMounted(() => {
  document.title = '收藏工作台 · HITORI ROOM';
  window.addEventListener('beforeunload', beforeUnload);
  if (!cloudConfigured) return;
  checkSession();
});
onBeforeUnmount(() => {
  alive = false;
  sessionRevision += 1;
  clearTimeout(authTimer);
  subscription?.unsubscribe();
  window.removeEventListener('beforeunload', beforeUnload);
});
</script>

<template>
  <main id="main" class="gallery-admin" tabindex="-1">
    <div class="admin-sheet">
      <header class="admin-heading">
        <RouterLink :to="{path:'/',hash:'#gallery'}" class="admin-back">← 回到收藏墙</RouterLink>
        <span class="admin-kicker">HITORI ROOM / OWNER'S DESK</span>
        <h1>把喜欢，<br>放进<span>收藏。</span></h1>
        <p>给这面墙，添一张新的心动。</p>
        <span class="admin-stamp" aria-hidden="true">COLLECT<br>THE MOMENT</span>
      </header>
      <section v-if="!cloudConfigured" class="admin-notice" aria-labelledby="setup-title">
        <span class="admin-step">COMING SOON</span>
        <h2 id="setup-title">上传入口尚未启用</h2>
        <p>请先完成服务配置。现有收藏仍可正常浏览。</p>
        <RouterLink :to="{path:'/',hash:'#gallery'}" class="admin-primary">去看看收藏 ↗</RouterLink>
      </section>
      <template v-else>
        <p v-if="checking" class="admin-notice" role="status">正在确认登录状态…</p>
        <form v-else-if="!session" class="admin-login" @submit.prevent="login">
          <span class="admin-step">01 / OWNER SIGN IN</span>
          <h2>站主登录</h2>
          <p class="admin-help">登录后，就可以把图片发布到收藏墙。</p>
          <label for="owner-email">邮箱</label>
          <input id="owner-email" v-model="email" type="email" autocomplete="username" required maxlength="254" :disabled="authBusy">
          <label for="owner-password">密码</label>
          <input id="owner-password" v-model="password" type="password" autocomplete="current-password" required :disabled="authBusy">
          <button class="admin-primary" type="submit" :disabled="authBusy || !client">{{ authBusy ? '正在登录…' : '进入我的收藏工作台 ↗' }}</button>
          <button v-if="connectionFailed" type="button" class="admin-primary" :disabled="authBusy" @click="checkSession">重新检查登录状态</button>
        </form>
        <section v-else-if="connectionFailed" class="admin-notice">
          <span class="admin-step">CONNECTION CHECK</span>
          <h2>暂时无法确认上传权限</h2>
          <p>云端连接尚未完成，请检查网络后重试。确认站主权限后，这里会显示图片上传表单。</p>
          <button type="button" class="admin-primary" :disabled="authBusy" @click="checkSession">重新检查登录状态</button>
          <button type="button" class="admin-primary" :disabled="authBusy" @click="logout">退出并更换账号</button>
        </section>
        <section v-else-if="!admin" class="admin-notice">
          <span class="admin-step">OWNER ONLY</span>
          <h2>这个账号没有上传权限</h2>
          <p>请使用已配置的站主账号登录。</p>
          <button type="button" class="admin-primary" :disabled="authBusy" @click="logout">退出并更换账号</button>
        </section>
        <section v-else class="admin-upload" :key="session.user.id">
          <div class="admin-session"><span>站主已登录 <small>{{ session.user.email }}</small></span><button type="button" :disabled="authBusy || uploading" @click="logout">退出登录</button></div>
          <nav class="admin-tabs" aria-label="收藏工作台分区"><button v-for="tab in [{id:'upload',label:'批量上传'},{id:'published',label:'已发布图片'},{id:'collections',label:'主题合集'}]" :key="tab.id" type="button" :aria-pressed="activeAdminTab===tab.id" @click="activeAdminTab=tab.id">{{tab.label}}</button></nav>
          <GalleryUploadQueue v-show="activeAdminTab==='upload'" ref="queueRef" @busy="uploading=$event" />
          <GalleryWorkbench v-if="activeAdminTab==='published'" />
          <GalleryCollectionManager v-if="activeAdminTab==='collections'" />
        </section>
        <p v-if="error" class="admin-feedback is-error" role="alert">{{ error }}</p>
        <div v-if="message" class="admin-feedback" role="status"><p>{{ message }}</p></div>
      </template>
      <footer class="admin-footer"><span>MY LITTLE COLLECTION</span><span aria-hidden="true">✦</span><span>好きなものを、少しずつ。</span></footer>
    </div>
  </main>
</template>

<style scoped>
.gallery-admin { min-height: 100dvh; padding: 125px 24px 50px; color: #493b47; background: #f6ecde; }
.admin-sheet { position: relative; max-width: 1040px; margin: auto; }
.admin-heading { position: relative; padding: 0 0 35px; border-bottom: 2px solid #594451; }
.admin-back { display: inline-block; margin-bottom: 35px; padding-block: 10px; color: #715869; font-size: 13px; }
.admin-kicker,.admin-step { display: block; font-size: 11px; font-weight: 700; letter-spacing: .13em; color: #8c6076; }
.admin-heading h1 { margin: 20px 0 12px; font-size: clamp(42px,7vw,76px); line-height: 1.16; letter-spacing: -.05em; }
.admin-heading h1 span { color: #ac456e; }
.admin-heading > p { font-size: 14px; color: #796579; }
.admin-stamp { position: absolute; right: 18px; top: 100px; padding: 20px 24px; border: 2px solid #ad7088; color: #ad7088; font: 800 clamp(14px,2vw,22px)/1.35 var(--font); letter-spacing: .05em; transform: rotate(9deg); }
.admin-notice,.admin-login { margin: 34px 0; padding-block: 12px; max-width: 500px; }
.admin-notice h2,.admin-login h2 { margin: 13px 0; font-size: 25px; }
.admin-notice p { margin-block: 14px 24px; line-height: 1.8; }
.admin-login { display: grid; }
.admin-help { color: #776271; font-size: 13px; line-height: 1.8; }
.admin-login label,.admin-details label { display: block; font-size: 14px; font-weight: 700; margin: 22px 0 9px; }
.admin-details label span { margin-left: 8px; font-size: 11px; font-weight: 400; color: #927380; }
.admin-login input,.admin-details input,.admin-details textarea { display: block; width: 100%; min-width: 0; border: 1px solid #b8a491; border-radius: 0; color: #493b47; background: #fffcf5; padding: 12px; font: inherit; font-size: 16px; }
.admin-details textarea { resize: vertical; }
.admin-primary { display: inline-flex; justify-content: center; align-items: center; min-height: 48px; padding: 12px 22px; margin-top: 22px; background: #663e55; border: 1px solid #663e55; color: #fff8ee; font-size: 14px; font-weight: 700; cursor: pointer; transition: background .2s; }
.admin-primary:hover:not(:disabled) { background: #893e62; }
button:disabled,fieldset:disabled,input:disabled { opacity: .65; cursor: default; }
.admin-session { display: flex; gap: 16px; align-items: center; justify-content: space-between; margin-block: 25px 32px; }
.admin-session > span { font-size: 13px; font-weight: 700; overflow-wrap: anywhere; }
.admin-session small { display: block; margin-top: 5px; font-weight: 400; color: #796579; }
.admin-session button { flex-shrink: 0; min-height: 44px; padding: 6px 0; background: transparent; border: 0; border-bottom: 1px solid #9c778d; color: #715869; font-size: 12px; }
.admin-tabs { display:flex;gap:10px;flex-wrap:wrap;margin:20px 0 30px; }.admin-tabs button { min-height:44px;padding:10px 18px;background:#fff8ef;border:1px solid #aa8b9d;color:#663e55;font:inherit;font-size:14px;cursor:pointer; }.admin-tabs button[aria-pressed="true"] { background:#663e55;color:#fff8ee; }
.admin-upload-grid { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 48px; }
.admin-file-label { display: block; margin: 22px 0 9px; font-weight: 700; font-size: 14px; }
.admin-file-input { display: block; width: 100%; font-size: 12px; color: #796579; }
.admin-file-input::file-selector-button { padding: 9px 12px; min-height: 44px; margin-right: 10px; border: 1px solid #ae8e9d; background: #fff8ef; color: #663e55; cursor: pointer; font: inherit; }
.admin-preview { display: grid; place-items: center; min-height: 300px; margin-top: 18px; padding: 14px; border: 1px dashed #b59b9b; background: #eee1d5; }
.admin-preview.has-image { background: #fffcf5; border-style: solid; border-color: #d8c5b3; }
.admin-preview img { max-width: 100%; max-height: 440px; object-fit: contain; }
.admin-preview-empty { text-align: center; color: #9b7787; }
.admin-preview-empty > span { display: block; font-size: 44px; font-weight: 200; }
.admin-preview-empty p { font-size: 14px; line-height: 1.8; }
.admin-file-meta { font-size: 11px; color: #796579; overflow-wrap: anywhere; line-height: 1.7; margin-top: 10px; }
.admin-details { min-width: 0; border: 0; margin: 0; padding: 0; }
.admin-details legend { padding: 0; }
.admin-details .admin-help { margin-top: 24px; }
.admin-details .admin-primary { width: 100%; }
.admin-feedback { margin-top: 28px; padding: 15px 18px; border-left: 3px solid #ac456e; background: #eadce1; line-height: 1.7; font-size: 14px; overflow-wrap: anywhere; }
.admin-feedback p { margin: 0; }
.admin-feedback a { display: inline-block; padding-block: 8px; color: #703a57; text-decoration: underline; }
.admin-feedback.is-error { color: #962f49; background: #f3dfdf; }
.admin-footer { display: flex; justify-content: space-between; gap: 12px; margin-top: 60px; border-top: 1px solid #baa895; padding-top: 19px; font-size: 10px; letter-spacing: .08em; color: #927380; }
:where(button,a,input,textarea):focus-visible { outline: 3px solid #ac456e; outline-offset: 4px; }
@media (max-width: 700px) {
  .gallery-admin { padding: 100px 20px 35px; }
  .admin-upload-grid { grid-template-columns: minmax(0,1fr); gap: 28px; }
  .admin-heading { padding-bottom: 25px; }
  .admin-stamp { right: 0; top: 110px; padding: 12px; font-size: 12px; }
  .admin-back { margin-bottom: 22px; }
  .admin-heading h1 { font-size: clamp(40px,10vw,58px); }
  .admin-preview { min-height: 250px; }
  .admin-preview img { max-height: 360px; }
  .admin-footer { letter-spacing: 0; flex-wrap: wrap; }
}
@media (max-width: 380px) { .admin-stamp { display: none; } .gallery-admin { padding-inline: 16px; } }
@media (prefers-reduced-motion: reduce) { .admin-primary { transition: none; } }
</style>
