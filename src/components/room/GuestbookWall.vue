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
  } catch (error) { event.preventDefault(); feedback.value = error.message; }
}
onMounted(refresh);
onBeforeUnmount(() => { alive = false; request?.abort(); });
</script>
<template>
  <section aria-labelledby="guestbook-title"><div class="room-panel"><h2 id="guestbook-title">留一句话，点一首歌。</h2><p class="room-intro">来信通过 GitHub 账号提交，由站主审核后随网站更新展示。</p>
    <div class="room-fields"><label class="room-field" for="letter-kind">来信类型<select id="letter-kind" v-model="kind"><option>留言</option><option>点歌</option></select></label><label class="room-field" for="letter-name">昵称（选填）<input id="letter-name" v-model="nickname" maxlength="40" autocomplete="nickname"></label></div>
    <label class="room-field" for="letter-message">想说的话<textarea id="letter-message" v-model="message" rows="4" maxlength="600" placeholder="写下一句感想，或说说为什么推荐这首歌。"></textarea></label>
    <div class="room-fields"><label class="room-field" for="letter-song">歌曲 / 演奏者{{ kind === '点歌' ? '（必填）' : '（选填）' }}<input id="letter-song" v-model="song" maxlength="120"></label><label class="room-field" for="letter-link">推荐链接（HTTPS，选填）<input id="letter-link" v-model="link" type="url" maxlength="1000" placeholder="https://…"></label></div>
    <label class="room-check"><input id="letter-consent" v-model="consent" type="checkbox">我知道内容会公开在 GitHub，审核通过后才在小屋展示。</label>
    <div class="room-actions"><a class="room-button primary" :href="submission || '#guestbook-title'" target="_blank" rel="noopener noreferrer" @click="prepare">在 GitHub 确认提交 ↗</a><a class="room-button" :href="issueList" target="_blank" rel="noopener noreferrer">查看来信 / 站主审核 ↗</a></div><p class="room-hint">请在新打开的 GitHub 页面登录并确认提交。填写的内容会随链接一起带到 GitHub，小屋只展示审核通过的来信。</p><p class="room-status" role="status">{{ feedback }}</p>
    </div>
    <div class="room-actions"><h3>已经抵达的小声音</h3><button type="button" :disabled="loading" @click="refresh">{{ loading ? '正在读取…' : '刷新来信' }}</button></div><p v-if="error" class="room-status" role="status">{{ error }}</p><p v-if="!loading && !wall.posts.length && !error" class="room-hint">还没有已审核的来信。第一句话，也可以很短。</p><p v-if="loading" class="room-hint" role="status">正在翻开来信…</p>
    <div class="room-cards"><article v-for="post in wall.posts" :key="post.issue" class="room-card guestbook-post"><p class="room-hint">{{ post.kind }} · {{ post.nickname || '路过小屋的人' }} · <time :datetime="post.approvedAt">{{ post.approvedAt.slice(0,10) }}</time></p><p class="guestbook-message">{{ post.message }}</p><p v-if="post.song">♪ {{ post.song }}</p><div class="room-actions"><a v-if="post.link" :href="post.link" target="_blank" rel="noopener noreferrer">打开推荐链接 ↗</a><a :href="`https://github.com/${community.repository}/issues/${post.issue}`" target="_blank" rel="noopener noreferrer">查看原来信 ↗</a></div></article></div>
    <p v-if="wall.updatedAt" class="room-hint">最近发布：{{ wall.updatedAt.slice(0,10) }}。只展示最近 100 封审核通过的来信。</p>
  </section>
</template>
<style scoped>.guestbook-message { white-space: pre-line; line-height: 1.9; }.guestbook-post .room-actions { gap: 12px; font-size: 12px; }.guestbook-post p { overflow-wrap: anywhere; }</style>
