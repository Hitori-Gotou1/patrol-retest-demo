<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { community, guestbookSubmissionUrl, validateGuestbookWall } from '../../room/guestbook.js';
const kind = ref('留言'), nickname = ref(''), message = ref(''), song = ref(''), link = ref(''), consent = ref(false);
const wall = ref({ posts: [], updatedAt: null }), loading = ref(false), feedback = ref(''), error = ref('');
const issueList = `https://github.com/${community.repository}/issues?q=${encodeURIComponent(`is:issue label:${community.pendingLabel}`)}`;
const draft = computed(() => ({ kind: kind.value, nickname: nickname.value, message: message.value, song: song.value, link: link.value }));
const submission = computed(() => { try { return guestbookSubmissionUrl(draft.value); } catch { return ''; } });
let request, alive = true;
async function refresh() {
  if (loading.value) return;
  loading.value = true; error.value = ''; request = new AbortController();
  const timeout = setTimeout(() => request.abort(), 12000);
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}community/guestbook.json`, { cache: 'no-cache', signal: request.signal });
    if (!response.ok) throw new Error();
    const next = validateGuestbookWall(await response.json());
    if (alive) wall.value = next;
  } catch { if (alive) error.value = '暂时无法读取来信，可以稍后刷新，或到 GitHub 查看。'; }
  finally { clearTimeout(timeout); if (alive) loading.value = false; }
}
function prepare(event) {
  feedback.value = '';
  try {
    if (!consent.value) throw new Error('请先确认公开提交说明。');
    guestbookSubmissionUrl(draft.value);
    feedback.value = '请在 GitHub 页面确认提交。审核通过后，来信会随小屋更新展示。';
  } catch (error) { event.preventDefault(); feedback.value = error.message; }
}
onMounted(refresh);
onBeforeUnmount(() => { alive = false; request?.abort(); });
</script>
<template>
  <section class="room-panel guestbook-room" aria-labelledby="guestbook-title">
    <header class="activity-title">
      <p class="play-eyebrow">小屋留言与点歌墙</p>
      <h2 id="guestbook-title">留一句话，点一首歌。</h2>
      <p class="room-intro">来信在 GitHub 确认提交，站主审核后随网站更新展示。</p>
    </header>
    <div class="guestbook-spread">
      <form class="guestbook-paper" :class="{ 'request-paper': kind === '点歌' }" aria-labelledby="guestbook-compose" @submit.prevent>
        <header class="guestbook-paper-head">
          <h3 id="guestbook-compose">{{ kind === '点歌' ? '今晚的点歌单' : '写给小屋的信' }}</h3>
          <label class="room-field" for="letter-kind">来信类型<select id="letter-kind" v-model="kind" @change="feedback = ''"><option>留言</option><option>点歌</option></select></label>
        </header>
        <label v-if="kind === '点歌'" class="room-field guestbook-song" for="letter-song">
          歌曲 / 演奏者（必填）
          <input id="letter-song" v-model="song" maxlength="120" required>
        </label>
        <label class="room-field guestbook-writing" for="letter-message">
          {{ kind === '点歌' ? '为什么推荐这首歌？' : '想说的话' }}
          <textarea id="letter-message" v-model="message" rows="5" maxlength="600" required placeholder="写下一句感想，或说说为什么推荐这首歌。"></textarea>
          <span class="letter-count">{{ message.length }} / 600 字</span>
        </label>
        <label v-if="kind === '留言'" class="room-field guestbook-song song-optional" for="letter-song">
          歌曲 / 演奏者（选填）
          <input id="letter-song" v-model="song" maxlength="120">
        </label>
        <div class="guestbook-sign">
          <label class="room-field" for="letter-name">昵称（选填）<input id="letter-name" v-model="nickname" maxlength="40" autocomplete="nickname"></label>
          <label class="room-field" for="letter-link">推荐链接（HTTPS，选填）<input id="letter-link" v-model="link" type="url" maxlength="1000" placeholder="https://…"></label>
        </div>
        <label class="room-check guestbook-consent">
          <input id="letter-consent" v-model="consent" type="checkbox">我知道内容会公开在 GitHub，审核通过后才在小屋展示。
        </label>
        <div class="room-actions guestbook-send">
          <a class="room-button primary" :href="submission || '#guestbook-title'" target="_blank" rel="noopener noreferrer" @click="prepare">在 GitHub 确认提交 ↗</a>
          <a class="room-button" :href="issueList" target="_blank" rel="noopener noreferrer">查看来信 / 站主审核 ↗</a>
        </div>
        <p class="review-notice">填写的内容会随链接带到 GitHub。请在那里登录并确认提交。</p>
        <p class="room-status guestbook-feedback" role="status">{{ feedback }}</p>
      </form>
      <section class="guestbook-received" aria-labelledby="guestbook-received">
        <div class="guestbook-wall-head">
          <h3 id="guestbook-received">已经抵达的小声音</h3>
          <button type="button" :disabled="loading" @click="refresh">{{ loading ? '正在读取…' : '刷新来信' }}</button>
        </div>
        <p v-if="error" class="room-status guestbook-error" role="status">{{ error }}</p>
        <div v-if="!loading && !wall.posts.length && !error" class="guestbook-empty">
          <svg viewBox="0 0 160 82" role="img" aria-label="空信架">
            <path d="M43 52V22a4 4 0 0 1 4-4h66a4 4 0 0 1 4 4v30" fill="#e9d5b8" stroke="#9b775d" stroke-width="2.5"/>
            <path d="m22 45 19-13m97 13-19-13v13M19 45h40l7 14h28l7-14h40l-11 29H30Z" fill="#edd9b8" stroke="#9b775d" stroke-width="2.5" stroke-linejoin="round"/>
            <path d="M58 31h44m-35-6h26M35 68h89" stroke="#a98770" fill="none" stroke-width="2"/>
          </svg>
          <p role="status">还没有已审核的来信。第一句话，也可以很短。</p>
        </div>
        <p v-if="loading" class="room-hint" role="status">正在翻开来信…</p>
        <div v-if="wall.posts.length" class="guestbook-stack">
          <article v-for="post in wall.posts" :key="post.issue" class="guestbook-post" :class="{ 'request-slip': post.kind === '点歌' }">
            <header>
              <h4 v-if="post.kind === '点歌'">{{ post.song }}</h4>
              <p class="letter-type">{{ post.kind }} · <time :datetime="post.approvedAt">{{ post.approvedAt.slice(0, 10) }}</time></p>
            </header>
            <p class="guestbook-message">{{ post.message }}</p>
            <p v-if="post.kind !== '点歌' && post.song" class="letter-enclosure">随信推荐 · {{ post.song }}</p>
            <p class="letter-from">{{ post.nickname || '路过小屋的人' }}</p>
            <div class="letter-links">
              <a v-if="post.link" :href="post.link" target="_blank" rel="noopener noreferrer">打开推荐链接 ↗</a>
              <a :href="`https://github.com/${community.repository}/issues/${post.issue}`" target="_blank" rel="noopener noreferrer">查看原来信 ↗</a>
            </div>
          </article>
        </div>
        <p v-if="wall.updatedAt" class="guestbook-updated">最近发布 {{ wall.updatedAt.slice(0, 10) }} · 最近 100 封审核通过的来信</p>
      </section>
    </div>
  </section>
</template>

<style scoped>
.guestbook-spread { display:grid; grid-template-columns:minmax(0,1.13fr) minmax(0,1fr); gap:clamp(15px,3vw,34px); align-items:start; }
.guestbook-paper { background:#fffaf0; border:1px solid #c4a58b; box-shadow:2px 5px 0 #ead7be; padding:clamp(15px,3vw,32px); display:flex; flex-direction:column; min-width:0; }
.guestbook-paper h3,.guestbook-wall-head h3 { margin:0; font-size:clamp(16px,2vw,22px); line-height:1.35; }
.guestbook-paper-head,.guestbook-wall-head { display:flex; flex-wrap:wrap; gap:8px 16px; align-items:center; justify-content:space-between; margin:0 0 9px; }
.guestbook-paper-head { border-bottom:2px solid #a87771; padding-bottom:7px; }
.guestbook-paper-head .room-field { max-width:126px; margin:0; }
.guestbook-paper :is(input:not([type=checkbox]), textarea, select) { background:#fffcf5; }
.guestbook-paper .guestbook-song { color:#6d374b; background:#f2d8d7; border-top:1px dashed #bc8a88; border-bottom:1px dashed #bc8a88; padding:7px 10px 9px; font-weight:700; order:1; }
.guestbook-paper .guestbook-song input { font-size:17px; border-color:#9e6979; }
.guestbook-paper .song-optional { background:none; color:#674d55; padding:0; border:0; font-weight:400; order:3; }
.guestbook-writing { order:2; margin-bottom:4px; }
.guestbook-writing textarea { padding:10px 13px; line-height:1.75; }
.letter-count { align-self:end; color:#795f5d; font-size:11px; }
.guestbook-sign { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1.2fr); gap:8px; order:4; }
.guestbook-consent { order:5; align-items:flex-start; line-height:1.5; margin:8px 0 2px; }
.guestbook-consent input { margin-top:.25em; }
.guestbook-send { order:6; margin-top:7px; }
.review-notice { order:7; margin:4px 0 0; color:#735650; font-size:12px; }
.guestbook-feedback { order:8; }
.guestbook-feedback:empty { display:none; }
.guestbook-wall-head { padding-bottom:6px; border-bottom:1px solid #ab8f7c; }
.guestbook-wall-head button { min-height:44px; font-size:12px; }
.guestbook-stack { display:grid; gap:12px; }
.guestbook-post { min-width:0; background:#fff8eb; border:1px solid #cbb39a; border-left:5px solid #bda384; padding:12px 16px; overflow-wrap:anywhere; }
.guestbook-post .letter-type { color:#785955; margin:0 0 4px; font-size:11px; }
.guestbook-message { white-space:pre-wrap; margin:0; font-size:14px; line-height:1.9; }
.letter-from { text-align:end; color:#6c4858; margin:8px 0 3px; font-size:13px; }
.letter-enclosure { color:#735056; margin:6px 0; font-size:13px; }
.request-slip { background:#f5e0dd; border-color:#c29b96; border-left:5px double #9f6674; }
.request-slip header { border-bottom:1px dashed #a47776; margin-bottom:6px; padding-bottom:5px; }
.request-slip header h4 { margin:2px 0; color:#55313f; font-size:clamp(17px,2vw,22px); line-height:1.34; }
.letter-links { display:flex; flex-wrap:wrap; gap:4px 12px; }
.letter-links a { min-height:44px; align-items:center; display:inline-flex; color:#704058; font-size:12px; text-underline-offset:3px; }
.guestbook-empty { background:#f6ebd7; border:1px dashed #bea187; color:#5a474c; text-align:center; padding:22px 12px; }
.guestbook-empty svg { width:111px; display:block; margin-inline:auto; }
.guestbook-empty p,.guestbook-updated { font-size:12px; }
.guestbook-updated { color:#705451; }
.guestbook-error { background:#f1d9d9; border-left:3px solid #9f6274; padding:7px 9px; }
@media(max-width:800px) {
  .guestbook-spread,.guestbook-sign { grid-template-columns:minmax(0,1fr); }
  .guestbook-paper { padding:12px; }
  .guestbook-sign { gap:0; }
  .guestbook-paper-head .room-field { max-width:105px; }
}
</style>
