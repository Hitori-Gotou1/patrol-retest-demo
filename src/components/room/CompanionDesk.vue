<script setup>
import '../../styles/review-folio.css';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { cast } from '../../data/playroom.js';
import { activityKinds } from '../../room/activityLog.js';
import { activityDestinations, companionDiaryLimit, diaryGroups } from '../../room/companionDiary.js';
import { readWorks, restoreWork, worksKey, workTypes } from '../../room/workshelf.js';
import { useCompanion } from '../../composables/useCompanion.js';
import CompanionControls from '../CompanionControls.vue';
const { state, saved, pinMemory, linkMemory, deleteMemory } = useCompanion();
const person = computed(() => cast.find(c => c.id === state.value.member));
const asset = path => `${import.meta.env.BASE_URL}${path}`;
const router = useRouter(), favoritesOnly = ref(false), date = ref(''), deleting = ref(''), linking = ref(''), workChoice = ref(''), message = ref('');
const works = ref(readWorks());
const grouped = computed(() => diaryGroups(state.value.diary, { pinned: favoritesOnly.value, date: date.value }));
const pinnedCount = computed(() => state.value.diary.filter(memory => memory.pinned).length);
const members = new Map(cast.map(member => [member.id,member]));
const memoryMember = memory => members.get(memory.member) || members.get('hitori');
const knownWorks = computed(() => new Map(works.value.map(work => [work.id,work])));
const workFor = memory => knownWorks.value.get(memory.workId);

function refreshWorks(event) { if (!event || event.type !== 'storage' || event.key === worksKey || event.key === null) works.value = readWorks(); }
function pin(memory) { pinMemory(memory.id, !memory.pinned); message.value = memory.pinned ? '已取消重要回忆。' : '这一页已夹进重要回忆。'; }
function chooseWork(memory) { linking.value = memory.id; workChoice.value = memory.workId; }
function saveLink(memory) {
  const work = works.value.find(work => work.id === workChoice.value);
  linkMemory(memory.id, work); linking.value = ''; message.value = work ? `已关联作品「${work.title}」。` : '已移除作品关联，回忆仍保留。';
}
function remove(memory) { deleteMemory(memory.id); deleting.value = ''; message.value = '这一页已删除，不会从近期活动中自动重新出现。'; }
async function openWork(memory) {
  try { const target = restoreWork(memory.workId); await router.push(target); }
  catch (error) { message.value = error.message; refreshWorks(); }
}
onMounted(() => { window.addEventListener('hitori:works-changed', refreshWorks); window.addEventListener('storage', refreshWorks); window.addEventListener('hitori:sync-applied', refreshWorks); });
onBeforeUnmount(() => { window.removeEventListener('hitori:works-changed', refreshWorks); window.removeEventListener('storage', refreshWorks); window.removeEventListener('hitori:sync-applied', refreshWorks); });
</script>
<template>
  <section class="room-panel review-folio companion-folio" aria-labelledby="companion-title">
    <header class="play-heading"><div><p class="play-eyebrow">伙伴手帐</p><h2 id="companion-title">那些小事，她都认真收好了。</h2><p class="room-intro">完成一段练习或保存一件作品，陪着你的那位伙伴会在这里留一页。</p></div></header>
    <div class="companion-desk">
      <figure class="companion-portrait" :style="{ '--buddy-color':person.color }">
        <img :src="asset(person.image)" alt="" width="260" height="300">
        <figcaption><small>现在陪着你</small><strong>{{ person.name }}</strong></figcaption>
      </figure>
      <CompanionControls />
    </div>
    <section class="companion-diary" aria-labelledby="diary-title">
      <header class="diary-head"><div><h3 id="diary-title">把日子，一页页翻回来。</h3><p>{{ state.diary.length }} 页 · 重要回忆 {{ pinnedCount }} 页</p></div>
        <div class="diary-filters">
          <label class="room-check"><input v-model="favoritesOnly" type="checkbox">只看重要回忆</label>
          <label class="room-field">回看日期<input v-model="date" type="date" aria-label="手帐日期"></label>
          <button v-if="date || favoritesOnly" type="button" @click="date='';favoritesOnly=false">看全部日期</button>
        </div>
      </header>
      <p class="room-status" role="status">{{ message }}</p>
      <div v-if="grouped.length" class="diary-days">
        <section v-for="day in grouped" :key="day.date" class="diary-day">
          <h4><time>{{ day.date }}</time><span>{{ day.memories.length }} 页</span></h4>
          <ol>
            <li v-for="memory in day.memories" :key="memory.id" class="diary-page" :data-memory-member="memory.member" :class="{ pinned:memory.pinned }">
              <div class="diary-page-heading">
                <div class="memory-member">
                  <img :src="asset(memoryMember(memory).thumbnail || memoryMember(memory).image)" alt="" width="48" height="56"
                    :style="{ background:memoryMember(memory).color }">
                  <span><strong>{{ memoryMember(memory).name }}</strong><small>{{ activityKinds[memory.kind] }}</small></span>
                </div>
                <button type="button" :aria-pressed="memory.pinned" :aria-label="`${memory.pinned ? '取消重要回忆' : '收藏重要回忆'}：${memory.detail}`"
                  @click="pin(memory)"><span aria-hidden="true" class="diary-bookmark">★</span>{{ memory.pinned ? '已夹星' : '夹星' }}</button>
              </div>
              <div class="memory-copy"><strong>{{ memory.detail }}</strong><p class="diary-reply">{{ memory.reply || '这件小事，也值得被认真记住。' }}</p></div>
              <div v-if="memory.workId" class="diary-work" :data-available="Boolean(workFor(memory))">
                <template v-if="workFor(memory)">
                  <img v-if="workFor(memory).preview" :src="workFor(memory).preview" :alt="workFor(memory).title+' 的小样'">
                  <div><small>{{ workTypes[workFor(memory).kind].label }}</small><strong>{{ workFor(memory).title }}</strong>
                    <button type="button" @click="openWork(memory)">继续编辑关联作品</button>
                  </div>
                </template>
                <div v-else><small>关联作品 · 本机暂不可用</small><strong>{{ memory.workTitle || '这份作品' }}</strong></div>
              </div>
              <div class="diary-actions">
                <RouterLink :to="`/room/${activityDestinations[memory.kind]}`">再去{{ activityKinds[memory.kind] }} ↗</RouterLink>
                <button type="button" @click="chooseWork(memory)">{{ memory.workId ? '调整作品关联' : '关联一件作品' }}</button>
                <button type="button" @click="deleting=memory.id">删除这一页</button>
              </div>
              <div v-if="linking===memory.id" class="diary-inline">
                <label class="room-field">选择本机作品<select v-model="workChoice"><option value="">不关联作品</option><option v-for="work in works" :key="work.id" :value="work.id">{{ work.title }}</option></select></label>
                <p v-if="!works.length" class="room-hint">作品架还空着。存入一件作品后，就能夹到手帐里。</p>
                <div class="room-actions"><button type="button" @click="saveLink(memory)">保存关联</button><button type="button" @click="linking=''">取消</button></div>
              </div>
              <div v-if="deleting===memory.id" class="diary-inline" role="group" aria-label="确认删除回忆">
                <p>删除这一页回忆？关联作品和活动记录会继续保留。</p>
                <div class="room-actions"><button type="button" @click="remove(memory)">确认删除这一页</button><button type="button" @click="deleting=''">留下这一页</button></div>
              </div>
            </li>
          </ol>
        </section>
      </div>
      <p v-else class="diary-empty">{{ favoritesOnly || date ? '这个范围暂时没有回忆。' : '手帐的第一页，还等着今天的小事。' }}</p>
      <p class="room-hint">{{ saved ? '手帐保存在当前设备。' : '浏览器暂时无法保存，手帐本次仍可查看。' }} 最多保留 {{ companionDiaryLimit }} 页，优先保留夹星的旧页。伙伴回应为本站创作。</p>
    </section>
  </section>
</template>

<style scoped>
.companion-desk { display:grid; grid-template-columns:minmax(140px,.72fr) minmax(0,1.3fr); gap:clamp(10px,3vw,30px); align-items:start; }
.companion-portrait { min-width:0; margin:0; display:grid; justify-items:center; align-items:center; border:1px solid #ba9a9e; background:color-mix(in srgb,var(--buddy-color) 27%,#f9e9d5); padding:10px; }
.companion-portrait img { width:min(100%,220px); height:clamp(120px,20vw,228px); object-fit:contain; }
.companion-portrait figcaption { display:grid; text-align:center; gap:4px; }
.companion-portrait figcaption small { font-size:12px; }
.companion-diary { margin-top:23px; }
.diary-head,.diary-filters { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px 12px; }
.diary-head { padding:10px 12px; background:#efdecb; border:1px solid #c4ab9f; }
.diary-head h3,.diary-head p { margin:0; }
.diary-head p { margin-top:3px; font-size:13px; }
.diary-filters { justify-content:flex-start; }
.diary-filters .room-field { min-width:0; font-size:12px; }
.diary-days { display:grid; gap:13px; }
.diary-day { min-width:0; border:1px solid #bd9aa6; background:#e6cdd2; box-shadow:2px 3px #b5939f; }
.diary-day h4 { display:flex; align-items:baseline; justify-content:space-between; margin:0; gap:6px; padding:8px 10px; color:#63485b; font-variant-numeric:tabular-nums; }
.diary-day h4 span { font-weight:400; font-size:11px; }
.diary-day ol { margin:0; padding:0; list-style:none; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:1px; }
.diary-day ol:has(>li:only-child) { grid-template-columns:minmax(0,1fr); }
.diary-page { position:relative; min-width:0; padding:10px 10px 8px; background:#fff5e6; }
.diary-page:nth-child(even) { background:#fcf0e0; }
.diary-page-heading,.memory-member { display:flex; align-items:center; gap:6px 10px; min-width:0; }
.diary-page-heading { justify-content:space-between; }
.memory-member img { width:48px; height:52px; object-fit:cover; object-position:top; border:1px solid #b58d9e; border-radius:48% 48% 4px 4px; }
.memory-member span,.diary-work>div { display:grid; min-width:0; gap:1px; }
.memory-member small,.diary-work small { color:#79546b; font-size:11px; }
.diary-page-heading button { flex:none; min-width:64px; padding-inline:5px; font-size:11px; }
.diary-bookmark { display:inline-grid; vertical-align:middle; place-items:center; width:16px; height:22px; margin-right:4px; color:#775269; background:#e5cbd5; clip-path:polygon(0 0,100% 0,100% 100%,50% 75%,0 100%); }
.diary-page.pinned .diary-bookmark { color:#fff7df; background:#94633d; }
.memory-copy { margin:10px 0 8px; }
.memory-copy>strong { color:#49323f; }
.diary-reply { margin:5px 0; color:#76576a; font-size:13px; }
.diary-work { display:flex; align-items:center; gap:8px; margin:7px 0; border:1px solid #c6a7a4; border-left:4px solid #aa7d8d; padding:6px; background:#f0dfcb; }
.diary-work[data-available=false] { border-style:dashed; background:#f3e5d7; }
.diary-work img { max-width:96px; width:29%; height:64px; object-fit:contain; background:#fcf4e6; border:1px solid #c3aaa6; }
.diary-work button { width:fit-content; text-align:left; padding-inline:6px; font-size:11px; }
.diary-actions { display:flex; flex-wrap:wrap; align-items:center; gap:5px; margin-top:9px; }
.diary-actions :is(a,button) { padding:4px 6px; font-size:11px; min-height:44px; display:inline-flex; align-items:center; }
.diary-actions a { color:#664359; }
.diary-inline,.diary-empty { border:1px dashed #b491a2; padding:10px; margin-top:7px; background:#f1e2d5; }
@media(max-width:690px) {
  .companion-desk,.diary-day ol { grid-template-columns:minmax(0,1fr); }
  .companion-portrait { grid-template-columns:82px minmax(0,1fr); justify-items:start; padding:5px 10px; }
  .companion-portrait img { height:82px; width:80px; }
  .companion-portrait figcaption { text-align:left; }
}
</style>
