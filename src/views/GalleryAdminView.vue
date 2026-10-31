<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { cloudConfigured, getCloudClient, isGalleryAdmin, publishGalleryImage } from '../services/galleryCloud.js';

const session = ref(null);
const checking = ref(cloudConfigured);
const admin = ref(false);
const authBusy = ref(false);
const uploading = ref(false);
const email = ref('');
const password = ref('');
const title = ref('');
const alt = ref('');
const credit = ref('');
const selectedFile = ref(null);
const preview = ref('');
const input = ref(null);
const message = ref('');
const error = ref('');
const published = ref(false);
const fileSize = computed(() => selectedFile.value ? `${(selectedFile.value.size / 1024 / 1024).toFixed(2)} MB` : '');
let client;
let subscription;
let alive = true;
let authTimer;
let sessionRevision = 0;

function clearFile() {
  if (preview.value) URL.revokeObjectURL(preview.value);
  preview.value = '';
  selectedFile.value = null;
  if (input.value) input.value.value = '';
}
function clearDraft() {
  clearFile();
  title.value = '';
  alt.value = '';
  credit.value = '';
}
async function syncSession(nextSession) {
  const revision = ++sessionRevision;
  if (session.value?.user?.id !== nextSession?.user?.id) {
    clearDraft();
    published.value = false;
  }
  session.value = nextSession;
  admin.value = false;
  checking.value = Boolean(nextSession);
  if (!nextSession) return;
  try {
    const allowed = await isGalleryAdmin();
    if (alive && revision === sessionRevision) admin.value = allowed;
  } catch {
    if (alive && revision === sessionRevision) error.value = '暂时无法确认上传权限，请稍后重新登录。';
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
    const result = await client.auth.signInWithPassword({ email: email.value.trim(), password: password.value });
    if (result.error) throw result.error;
    if (alive) {
      password.value = '';
      await syncSession(result.data.session);
    }
  } catch (cause) {
    if (alive) error.value = cause?.code === 'email_not_confirmed' ? '请先完成邮箱验证，再登录。' : '登录失败，请检查邮箱、密码及网络连接。';
  } finally {
    if (alive) authBusy.value = false;
  }
}
async function logout() {
  if (authBusy.value || uploading.value || !client) return;
  authBusy.value = true;
  error.value = '';
  try {
    const result = await client.auth.signOut();
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
function chooseFile(event) {
  if (uploading.value) return;
  const file = event.target.files?.[0];
  if (!file) return;
  clearFile();
  error.value = '';
  message.value = '';
  published.value = false;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    error.value = '请选择 JPG、PNG 或 WebP 图片。';
    return;
  }
  if (file.size > 10 * 1024 * 1024 || file.size === 0) {
    error.value = '图片大小需大于 0 且不超过 10 MB。';
    return;
  }
  selectedFile.value = file;
  preview.value = URL.createObjectURL(file);
  if (!title.value) title.value = file.name.replace(/\.[^.]+$/, '').slice(0, 120);
}
function previewFailed() {
  clearFile();
  error.value = '无法读取这张图片，请换一张有效的图片文件。';
}
async function publish() {
  if (uploading.value || !admin.value) return;
  error.value = '';
  published.value = false;
  if (!selectedFile.value || !title.value.trim()) {
    error.value = '请先选择图片，并填写标题。';
    return;
  }
  uploading.value = true;
  message.value = '正在准备图片…';
  try {
    await publishGalleryImage({
      file: selectedFile.value, title: title.value.trim(), alt: alt.value.trim(), credit: credit.value.trim(),
      onProgress: progress => { if (alive) message.value = progress; }
    });
    if (alive) {
      clearDraft();
      published.value = true;
      message.value = '已发布到收藏区，所有访客都可以看到。';
    }
  } catch (cause) {
    if (alive) {
      message.value = '';
      error.value = cause?.message || '上传失败，请稍后重试。';
    }
  } finally {
    if (alive) uploading.value = false;
  }
}
function beforeUnload(event) {
  if (!uploading.value) return;
  event.preventDefault();
  event.returnValue = '';
}
onBeforeRouteLeave(() => !uploading.value || window.confirm('图片仍在发布中，离开可能中断上传。确定离开吗？'));
onMounted(async () => {
  document.title = '上传收藏 · HITORI ROOM';
  window.addEventListener('beforeunload', beforeUnload);
  if (!cloudConfigured) return;
  try {
    client = await getCloudClient();
    if (!alive || !client) return;
    const { data, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    if (!alive) return;
    await syncSession(data.session);
    if (!alive) return;
    // Supabase 的认证回调中不直接等待 API，避免与内部会话锁互相等待。
    subscription = client.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'TOKEN_REFRESHED' && session.value?.user?.id === nextSession?.user?.id) return;
      clearTimeout(authTimer);
      authTimer = setTimeout(() => { if (alive) syncSession(nextSession); }, 0);
    }).data.subscription;
  } catch {
    if (alive) error.value = '暂时无法连接上传服务，请检查网络后刷新页面。';
  } finally {
    if (alive) checking.value = false;
  }
});
onBeforeUnmount(() => {
  alive = false;
  sessionRevision += 1;
  clearTimeout(authTimer);
  subscription?.unsubscribe();
  window.removeEventListener('beforeunload', beforeUnload);
  clearFile();
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
        </form>
        <section v-else-if="!admin" class="admin-notice">
          <span class="admin-step">OWNER ONLY</span>
          <h2>这个账号没有上传权限</h2>
          <p>请使用已配置的站主账号登录。</p>
          <button type="button" class="admin-primary" :disabled="authBusy" @click="logout">退出并更换账号</button>
        </section>
        <form v-else class="admin-upload" @submit.prevent="publish" :aria-busy="uploading">
          <div class="admin-session"><span>站主已登录 <small>{{ session.user.email }}</small></span><button type="button" :disabled="authBusy || uploading" @click="logout">退出登录</button></div>
          <div class="admin-upload-grid">
            <div class="admin-image-area">
              <span class="admin-step">01 / CHOOSE A MOMENT</span>
              <label class="admin-file-label" for="gallery-upload-file">{{ selectedFile ? '重新选择图片' : '选择一张图片' }}</label>
              <input id="gallery-upload-file" ref="input" class="admin-file-input" type="file" accept="image/jpeg,image/png,image/webp" :disabled="uploading" @change="chooseFile">
              <div class="admin-preview" :class="{ 'has-image': preview }">
                <img v-if="preview" :src="preview" alt="即将上传的图片预览" @error="previewFailed">
                <div v-else class="admin-preview-empty"><span aria-hidden="true">＋</span><p>下一份心动<br>从这里开始</p></div>
              </div>
              <p class="admin-file-meta">{{ selectedFile ? `${selectedFile.name} · ${fileSize}` : 'JPG / PNG / WebP · 每张不超过 10 MB' }}</p>
            </div>
            <fieldset :disabled="uploading" class="admin-details">
              <legend class="admin-step">02 / LEAVE A NOTE</legend>
              <label for="gallery-upload-title">给它取个名字 <span>必填</span></label>
              <input id="gallery-upload-title" v-model="title" required maxlength="120" placeholder="例如：一起，走向晴天">
              <label for="gallery-upload-alt">画面描述 <span>选填</span></label>
              <textarea id="gallery-upload-alt" v-model="alt" maxlength="300" rows="3" placeholder="简单描述画面，方便使用读屏的访客了解图片。"></textarea>
              <label for="gallery-upload-credit">作者 / 来源 <span>选填</span></label>
              <input id="gallery-upload-credit" v-model="credit" maxlength="200" placeholder="填写作者名或图片来源">
              <p class="admin-help">发布后会出现在「站主收藏」中，所有访客可见。</p>
              <button class="admin-primary" type="submit" :disabled="uploading || !selectedFile || !title.trim()">{{ uploading ? '正在发布…' : '发布到收藏墙 ↗' }}</button>
            </fieldset>
          </div>
        </form>
        <p v-if="error" class="admin-feedback is-error" role="alert">{{ error }}</p>
        <div v-if="message" class="admin-feedback" role="status"><p>{{ message }}</p><RouterLink v-if="published" :to="{path:'/',hash:'#gallery'}">查看新收藏 ↗</RouterLink></div>
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
