<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue';
import { relaySeeds } from '../../data/playground.js';
import { relayCommunity, validateRelayWall, validateRelayDraft, relaySubmissionUrl } from '../../room/relayStory.js';
import { useLocalDraft } from '../../composables/useLocalDraft.js';
import { recordActivity } from '../../room/activityLog.js';

function validate(value) {
  if (!value || value.version !== 1) throw new Error('无法读取接龙草稿。');
  const groups = relaySeeds.map((_, i) => {
    const entries = Array.isArray(value.local?.[i]) ? value.local[i] : [];
    return entries.flatMap((line, index) => typeof line === 'string' && line.trim() && line.length <= 100
      ? [{ line, nickname:typeof value.bylines?.[i]?.[index] === 'string' ? value.bylines[i][index].slice(0,40) : '' }]
      : []).slice(0,6);
  });
  return {
    version:1, nickname:String(value.nickname || '').slice(0,40), line:String(value.line || '').slice(0,100),
    local:groups.map(parts => parts.map(part => part.line)), bylines:groups.map(parts => parts.map(part => part.nickname)),
    mode:value.mode === 'local' ? 'local' : 'public',
    index:Number.isInteger(value.index) && relaySeeds[value.index] ? value.index : 0
  };
}
const empty = validate({ version:1 });
const { state, saved } = useLocalDraft('hitori-room:relay:v1', empty, validate);
const wall = ref(null), ready = ref(false), loading = ref(false), consent = ref(false);
const message = ref(''), fetchMessage = ref('');
const writingArea = ref(null), lineInput = ref(null);
const unfurl = ref(false);
const seed = computed(() => relaySeeds[state.value.index]);
const localMode = computed(() => state.value.mode === 'local');
const publicStory = computed(() => wall.value?.stories.find(story => story.id === seed.value.id));
const local = computed(() => state.value.local[state.value.index]);
const bylines = computed(() => state.value.bylines[state.value.index]);
const count = computed(() => localMode.value ? local.value.length : publicStory.value?.count || 0);
const last = computed(() => localMode.value ? local.value.at(-1) || seed.value.opening : publicStory.value?.lastLine || seed.value.opening);
const lastByline = computed(() => localMode.value ? bylines.value[count.value-1] : '');
const parts = computed(() => {
  if (count.value !== 6) return [];
  return localMode.value ? local.value.map((line, i) => ({ line, nickname:bylines.value[i] || '' })) : publicStory.value.parts;
});
const url = computed(() => {
  if (!ready.value || !consent.value || count.value >= 6 || localMode.value) return '';
  try {
    return relaySubmissionUrl(validateRelayDraft({
      storyId:seed.value.id, chapter:count.value+1, parentIssue:publicStory.value.lastIssue,
      nickname:state.value.nickname, line:state.value.line
    }));
  } catch { return ''; }
});

let controller, timeout;
async function refresh() {
  if (loading.value) return;
  const request = new AbortController();
  controller = request;
  timeout = setTimeout(() => request.abort(),8000);
  loading.value = true;
  ready.value = false;
  fetchMessage.value = '正在读取已审核的接龙…';
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}community/relay-stories.json?t=${Date.now()}`, { signal:request.signal, cache:'no-store' });
    if (!response.ok) throw new Error();
    wall.value = validateRelayWall(await response.json());
    ready.value = true;
    fetchMessage.value = '已读取审核后的故事。';
  } catch {
    fetchMessage.value = '公开接龙暂时无法读取。稍后可刷新，也可以先玩本机练习。';
  } finally {
    loading.value = false;
    clearTimeout(timeout);
  }
}
function chooseView(mode, index = state.value.index) {
  state.value.mode = mode;
  state.value.index = index;
  consent.value = false;
  unfurl.value = false;
  message.value = '';
}
function practice() {
  try {
    const draft = validateRelayDraft({
      storyId:seed.value.id, chapter:local.value.length+1, parentIssue:local.value.length,
      nickname:state.value.nickname, line:state.value.line
    });
    local.value.push(draft.line);
    bylines.value.push(draft.nickname);
    state.value.line = '';
    if (local.value.length === 6) {
      unfurl.value = true;
      recordActivity('relay',`本机练习完成 · ${seed.value.title}`,local.value.join('|'));
      message.value = '六句写好了，整张故事纸已展开。';
    } else {
      message.value = `第 ${count.value} 句已折好，下一位可以接着写。`;
    }
  } catch (error) { message.value = error.message; }
}
function reset() {
  state.value.local[state.value.index] = [];
  state.value.bylines[state.value.index] = [];
  state.value.line = '';
  unfurl.value = false;
  message.value = '';
}
function keepWritingVisible() {
  const viewport = window.visualViewport;
  if (!viewport || viewport.scale !== 1 || document.activeElement !== lineInput.value || !writingArea.value) return;
  const bounds = writingArea.value.getBoundingClientRect();
  const headerBottom = document.querySelector('.site-header')?.getBoundingClientRect().bottom || 0;
  const top = Math.max(headerBottom, viewport.offsetTop) + 8;
  const bottom = viewport.offsetTop + viewport.height - 8;
  if (bottom - top < bounds.height) return;
  const shift = bounds.top < top ? bounds.top - top : Math.max(0, bounds.bottom - bottom);
  if (shift) window.scrollBy({ top: shift, behavior: 'instant' });
}
onMounted(() => {
  refresh();
  window.visualViewport?.addEventListener('resize', keepWritingVisible);
});
onBeforeUnmount(() => {
  controller?.abort();
  clearTimeout(timeout);
  window.visualViewport?.removeEventListener('resize', keepWritingVisible);
});
</script>

<template>
  <section class="room-panel relay-room" aria-labelledby="relay-title">
    <header class="activity-title">
      <p class="pg-kicker">创作室 · 六折接龙</p>
      <h2 id="relay-title">上一句之后，会发生什么？</h2>
      <p class="room-intro">接着眼前这一句写。第六句落笔后，整张故事纸一起展开。</p>
    </header>
    <div class="pg-toolbar">
      <button :aria-pressed="!localMode" @click="chooseView('public')">公开接龙 · 站主审核</button>
      <button :aria-pressed="localMode" @click="chooseView('local')">本机练习</button>
      <button :disabled="loading" @click="refresh">{{ loading ? '读取中…' : '刷新公开接续' }}</button>
    </div>
    <div class="pg-toolbar relay-seeds">
      <button v-for="(item,i) in relaySeeds" :key="item.id" :aria-pressed="state.index === i" @click="chooseView(state.mode,i)">{{ item.title }}</button>
    </div>
    <p v-if="!localMode && !ready" class="relay-notice" role="status">{{ fetchMessage }}</p>
    <div class="relay-spread" :class="{ 'is-complete': count === 6 }">
      <article class="relay-paper" :class="{ 'is-local':localMode, 'is-printed':!localMode }" :data-fold-count="count">
        <header><h3>{{ seed.title }}</h3><span>{{ localMode ? '本机练习' : '公开审核稿' }} · {{ count }} / 6</span></header>
        <div v-if="count < 6" class="relay-pocket">
          <span v-for="fold in Math.max(0,count-1)" :key="fold" class="relay-closed-fold" aria-hidden="true"></span>
          <div class="relay-current-fold" aria-live="polite">
            <small>{{ count ? '第 ' + count + ' 句' : '故事种子' }}</small>
            <blockquote>{{ last }}</blockquote>
            <p v-if="lastByline" class="relay-signature">{{ lastByline }}</p>
          </div>
        </div>
        <div v-else class="relay-complete" :class="{ 'relay-unfurl':unfurl }" @animationend="unfurl = false">
          <p class="relay-opening">{{ seed.opening }}</p>
          <ol class="relay-open-folds">
            <li v-for="(part,i) in parts" :key="i">
              <p class="relay-fold-number">第 {{ i+1 }} 句</p>
              <p class="relay-fold-text">{{ part.line }}</p>
              <small v-if="part.nickname" class="relay-signature">{{ part.nickname }}</small>
              <a v-if="part.issue" :href="`https://github.com/${relayCommunity.repository}/issues/${part.issue}`" target="_blank" rel="noopener noreferrer">原投稿 ↗</a>
            </li>
          </ol>
        </div>
      </article>
      <form v-if="count < 6" class="pg-settings relay-form" aria-labelledby="relay-write-title" @submit.prevent="localMode ? practice() : null">
        <div ref="writingArea" class="relay-writing">
          <div class="relay-writing-head">
            <h3 id="relay-write-title">写下下一句</h3>
            <label for="relay-next-line">第 {{ count + 1 }} 句</label>
            <span id="relay-count">{{ state.line.length }} / 100 字</span>
          </div>
          <textarea id="relay-next-line" ref="lineInput" v-model="state.line" maxlength="100" rows="3" aria-describedby="relay-count" placeholder="接过上一句，写一个小小的转折。"></textarea>
        </div>
        <div class="relay-entry-actions" :class="{ 'relay-approval': !localMode }">
          <label class="relay-nickname">你的昵称（可不填）<input v-model="state.nickname" maxlength="40"></label>
          <button v-if="localMode" id="relay-practice" type="submit" class="primary">折好纸条，交给下一位 →</button>
          <template v-else>
            <label class="relay-consent"><input v-model="consent" type="checkbox"> 我知道内容会公开，且需要站主审核。</label>
            <a v-if="url" id="relay-submit" class="room-button primary" :href="url" target="_blank" rel="noopener noreferrer">打开 GitHub，核对并提交 →</a>
            <button v-else type="button" disabled>{{ !ready ? '先读取公开接续' : '填写一句并确认公开说明' }}</button>
          </template>
        </div>
        <p v-if="!localMode" class="pg-small relay-public-note">投稿需要登录 GitHub 并确认公开提交，站主审核后才会展示。多人同时接同一句时，请刷新后核对接续位置。</p>
      </form>
    </div>
    <button v-if="localMode && count === 6" type="button" @click="reset">开始新的本机接龙</button>
    <p class="pg-status" role="status">{{ message }}</p>
    <p class="pg-small">{{ saved ? '本机练习和未投稿的草稿保存在当前浏览器。' : '本机存档暂不可用。' }}</p>
  </section>
</template>

<style scoped>
.relay-room .pg-toolbar button { min-height:44px; }
.relay-spread { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); align-items:start; gap:clamp(10px,2vw,22px); margin:13px 0 18px; }
.relay-spread.is-complete { grid-template-columns:minmax(0,1fr); }
.relay-paper { --fold-edge:#9f8a7d; --fold-face:#fff7e5; background:#eedec6; border:1px solid #b69d87; padding:clamp(9px,2.1vw,24px); margin:0; box-shadow:2px 3px 0 #cdb59e; }
.relay-paper.is-local { --fold-edge:#997781; --fold-face:#fffaed; }
.relay-paper.is-printed { --fold-edge:#8a5e72; --fold-face:#fbedd9; }
.relay-paper>header { display:flex; flex-wrap:wrap; justify-content:space-between; align-items:baseline; gap:5px 12px; border-bottom:1px solid #c4aa90; margin:0 0 11px; padding-bottom:7px; }
.relay-paper>header h3 { margin:0; font-size:clamp(16px,3vw,24px); color:#503449; }
.relay-paper>header span { color:#6c4d53; font-size:12px; }
.relay-notice { background:#efd7ce; color:#694153; border-left:3px solid #a86b79; padding:6px 10px; font-size:12px; }
.relay-pocket { display:flex; align-items:stretch; min-height:128px; margin:2px 0 3px; }
.relay-closed-fold { background:linear-gradient(93deg,#b39a85,#eddcc3 35%,#b39a85 95%); flex:0 0 clamp(8px,1.3vw,18px); border-block:1px solid #b89c82; }
.relay-closed-fold:nth-child(2n) { background:linear-gradient(91deg,#e6cdb4,#b29a82); }
.relay-current-fold { flex:1; min-width:0; padding:clamp(10px,2.7vw,25px); border:1px solid var(--fold-edge); background:var(--fold-face); }
.is-local .relay-current-fold,.is-local .relay-open-folds li { border-left:2px dashed var(--fold-edge); }
.is-printed .relay-current-fold,.is-printed .relay-open-folds li { border-left:3px double var(--fold-edge); }
.relay-current-fold small,.relay-fold-number { color:#785459; font-size:12px; font-weight:700; }
.relay-current-fold blockquote { font-size:clamp(16px,2.7vw,22px); line-height:1.9; color:#50364a; margin:8px 0 0; overflow-wrap:anywhere; }
.relay-signature { display:block; text-align:right; color:#684655; font-size:12px; margin:5px 0 0; }
.relay-opening { color:#61464d; font-size:14px; margin:0 0 8px; }
.relay-open-folds { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); list-style:none; padding:0; margin:0; gap:2px; }
.relay-open-folds li { padding:9px; background:var(--fold-face); border:1px solid var(--fold-edge); box-shadow:inset -4px 0 #aa816511; min-width:0; overflow-wrap:anywhere; }
.relay-open-folds li:nth-child(even) { background:#f3e3cc; }
.relay-fold-number { margin:0 0 5px; }
.relay-fold-text { color:#4e3b47; font-size:14px; margin:0; }
.relay-open-folds a { display:inline-flex; align-items:center; min-height:44px; font-size:12px; text-underline-offset:4px; color:#71435e; }
.relay-form { min-width:0; gap:10px; padding:clamp(10px,2.1vw,24px); background:#fff8e8; color:#4c3443; border:1px solid #b69d87; box-shadow:2px 3px 0 #cdb59e; }
.relay-writing { min-width:0; }
.relay-writing-head { display:flex; align-items:baseline; flex-wrap:wrap; gap:4px 10px; color:#6e4d5e; margin-bottom:5px; }
.relay-writing-head h3 { margin:0; color:#4c3043; font-size:clamp(1rem,3vw,1.375rem); line-height:1.4; }
.relay-writing-head label,.relay-writing-head span { font-size:.8125rem; }
#relay-count { margin-inline-start:auto; white-space:nowrap; font-variant-numeric:tabular-nums; }
.relay-form textarea { display:block; width:100%; min-height:5rem; padding:8px; border:1px solid #cbad98; border-bottom:2px solid #926878; background:#fffdf4; color:#422c39; font-size:1rem; line-height:1.55; resize:vertical; scroll-margin-block-start:8.5rem; }
.relay-form textarea::placeholder { color:#7a6569; }
.relay-entry-actions { display:flex; flex-wrap:wrap; justify-content:space-between; align-items:end; gap:7px 12px; }
.relay-entry-actions > :is(button,a) { min-height:44px; text-align:center; white-space:normal; }
.relay-approval { display:grid; grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr); }
.relay-approval > :is(button,a) { grid-column:1/-1; justify-self:start; }
.relay-form .relay-nickname { flex:1 1 8rem; gap:3px; min-width:0; max-width:13rem; }
.relay-nickname input { width:100%; min-width:0; min-height:44px; font-size:1rem; }
.relay-form .relay-consent { display:flex; gap:8px; align-items:center; min-height:44px; font-size:.8125rem; line-height:1.5; }
.relay-consent input { flex:none; }
.relay-public-note { margin:0; }
.relay-room > .pg-status:empty { display:none; }
.relay-unfurl { animation:relay-unfold .34s ease-out both; transform-origin:top left; }
@keyframes relay-unfold { from { transform:scale(.985); opacity:.65; } to { transform:scale(1); opacity:1; } }
@media(max-width:1000px) { .relay-open-folds { grid-template-columns:repeat(3,minmax(0,1fr)); } }
@media(max-width:750px) { .relay-spread { grid-template-columns:minmax(0,1fr); } }
@media(max-width:600px) {
  .relay-open-folds { grid-template-columns:minmax(0,1fr); }
  .relay-open-folds li { min-height:92px; }
  .relay-room .relay-seeds { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:4px; }
  .relay-seeds button { padding:4px; font-size:.75rem; }
  .relay-pocket { min-height:0; }
}
@media(prefers-reduced-motion:reduce) { .relay-unfurl { animation:none; } }
</style>
