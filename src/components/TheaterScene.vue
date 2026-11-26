<script setup>
import { ref, computed, shallowRef, onBeforeUnmount } from 'vue';
import { useChord } from '../composables/useChord.js';
import { interactionFeatures } from '../data/interactions.js';
import { liveModeActive } from '../composables/useInteractionSession.js';
import SceneAtmosphere from './motion/SceneAtmosphere.vue';
import SmoothFold from './motion/SmoothFold.vue';
import TheaterPanelArt from './TheaterPanelArt.vue';
import { useSceneMotion } from '../composables/useSceneMotion.js';
const root = ref(null), growthOpen = ref(false);
useSceneMotion(root);
import PlayroomPreview from './PlayroomPreview.vue';
const selected = ref('box');
const scenes = {
 name:{label:'突然被叫到名字',title:'叫、叫的是我吗？',text:'脑内已经排练了十种打招呼方式。现实进度：抬头，停顿，再停顿。',note:'社交电量：正在重新连接'},
 box:{label:'躲进纸箱充电',title:'纸箱里，暂时安全。',text:'先躲一小会儿。等心跳慢下来，再试着向外迈一步。',note:'社交电量：安静充电中'},
 guitar:{label:'终于拿起吉他',title:'这一次，让吉他先开口。',text:'说不出口的话，终于找到了出口。手指记得那些一个人练习的夜晚。',note:'社交电量：舞台限定满格'}
};
const current = computed(() => scenes[selected.value]);
const { playing, message, play } = useChord();
const liveOpen = ref(false);
const liveLoading = ref(false);
const liveMessage = ref('');
const liveEntry = ref(null);
const LiveStage = shallowRef(null);
let disposed = false;
async function enterLive() {
  if (liveLoading.value || liveOpen.value) return;
  liveLoading.value = true;
  liveMessage.value = '';
  try {
    // 舞台与专属样式仅在首次入场时下载，之后重复使用已缓存的模块。
    LiveStage.value ||= (await import('./StarryLiveMode.vue')).default;
    if (disposed) return;
    liveModeActive.value = true;
    liveOpen.value = true;
  } catch {
    liveMessage.value = '舞台暂时没有准备好，请稍后再试一次。';
  } finally { liveLoading.value = false; }
}
function leaveLive() { liveOpen.value = false; liveModeActive.value = false; }
onBeforeUnmount(() => { disposed = true; liveModeActive.value = false; });
</script>
<template>
    <section ref="root" class="theater-scene scene" id="theater" data-scene-name="纸箱剧场" aria-labelledby="theater-title">
      <SceneAtmosphere kind="theater" />
      <div class="scene-inner">
        <div class="scene-heading" data-arrive="0"><div><span class="scene-kicker">纸箱剧场</span><h2 id="theater-title">嘘，纸箱里有人。</h2></div></div>
        <p class="scene-intro">如果此刻是一里，她的脑内小剧场大概已经开演了。</p>
      <div class="theater-section" data-arrive="1">

        <div class="scene-controls" role="group" aria-label="选择脑内小剧场情境">
          <button v-for="(scene, id) in scenes" :key="id" type="button" :data-scene="id"
            :aria-pressed="selected === id" aria-controls="bocchi-theater" @click="selected = id">
            <span class="theater-panel-preview"><TheaterPanelArt :scene="id" /></span><span>{{ scene.label }}</span>
          </button>
        </div>
        <div class="bocchi-theater" id="bocchi-theater" :data-scene="selected">
          <div class="theater-visual" aria-hidden="true"><TheaterPanelArt :key="selected" :scene="selected" /></div>
          <div class="thought-panel">
            <div class="thought-bubble" role="status" aria-live="polite" aria-atomic="true">
              <h3 id="thought-title">{{ current.title }}</h3><p id="thought-text">{{ current.text }}</p><span id="scene-note">{{ current.note }}</span>
            </div>
          </div>
        </div>
        <div class="strum-row">
          <button id="strum-button" class="strum-button" :data-playing="playing || undefined" @click="play" type="button"><span class="string-icon" aria-hidden="true">≋</span><span id="strum-label">听一声和弦</span><span aria-hidden="true">♪</span></button>
          <span class="sound-hint">轻轻拨一下，只响一小段</span>
          <p class="strum-status" id="strum-status" role="status" aria-live="polite">{{ message }}</p>
        </div>
      </div>
      <div class="growth-note"><button type="button" class="growth-summary" :aria-expanded="growthOpen" aria-controls="growth-story" @click="growthOpen=!growthOpen"><span><span class="growth-dot" aria-hidden="true"></span> 从房间到舞台，那些很小、很重要的变化</span><span class="details-symbol" aria-hidden="true">＋</span></button><SmoothFold id="growth-story" :open="growthOpen"><ol><li><strong>一个人，也认真练习。</strong><p>在房间里反复磨练技巧，在网络上以「吉他英雄」的身份分享演奏。</p></li><li><strong>有人邀请，就试着迈一步。</strong><p>虹夏的出现，让一个人的吉他声有了与鼓、贝斯和歌声相遇的机会。</p></li><li><strong>带着紧张，继续站上舞台。</strong><p>信心没有突然变满。但她开始为了伙伴，尝试把练习过的声音真正弹出来。</p></li></ol></SmoothFold></div>
      <div v-if="interactionFeatures.liveMode" class="starry-ticket" data-arrive="2">
        <div class="starry-ticket-copy"><span>ONE NIGHT / FOUR COLORS</span><h3>房间之外，舞台之上。</h3><p>灯光就位。今晚的 STARRY，也为你留了位置。</p></div>
        <button id="enter-starry" ref="liveEntry" type="button" :disabled="liveLoading" :aria-busy="liveLoading" @click="enterLive"><small>LIVE HOUSE / 下北沢</small><strong>{{ liveLoading ? '准备舞台…' : 'ENTER STARRY' }} <span aria-hidden="true">↗</span></strong><span class="starry-ticket-tear" aria-hidden="true"></span></button>
        <p v-if="liveMessage" class="starry-entry-status" role="status">{{ liveMessage }}</p>
      </div>
      <RouterLink to="/room/stories" class="room-entry-link">把故事接下去 · 分支小剧场 ↗</RouterLink>
      <PlayroomPreview />
      </div>
    </section>
    <component :is="LiveStage" v-if="liveOpen" :return-focus="liveEntry" @close="leaveLive" />
</template>

<style scoped>
.starry-ticket { margin-top:32px; display:grid; grid-template-columns:1fr auto; align-items:center; gap:24px; padding:25px 30px; background:#251d2c; color:#fff8ec; position:relative; border:1px solid #66516a; }
.starry-ticket-copy > span { font:8px var(--mono); letter-spacing:2.5px; color:#f6c945; }
.starry-ticket-copy h3 { font-size:24px; margin:10px 0 6px; letter-spacing:1px; font-weight:600; }
.starry-ticket-copy p { font-size:11px; line-height:1.7; margin:0; color:#c7b6c9; }
#enter-starry { position:relative; display:flex; flex-direction:column; align-items:flex-start; justify-content:center; gap:7px; background:#f6c945; color:#292012; border:0; padding:17px 24px; min-height:85px; min-width:225px; transform:rotate(-2deg); transition:transform .2s; }
#enter-starry:hover { transform:rotate(0deg) translateY(-2px); }
#enter-starry:active { transform:scale(.98); }
#enter-starry small { font:8px var(--mono); letter-spacing:1px; }
#enter-starry strong { font:800 19px Arial,sans-serif; letter-spacing:-.3px; }
#enter-starry strong > span { margin-left:12px; }
.starry-ticket-tear { position:absolute; top:0; bottom:0; left:-4px; width:8px; background:radial-gradient(circle at 50% 50%,#251d2c 0 3px,transparent 3.5px) 0 0/8px 13px; }
.starry-entry-status { grid-column:1/-1; font-size:11px; margin:0; color:#f6c945; }
@media (max-width:600px) { .starry-ticket { padding:23px; grid-template-columns:1fr; gap:21px; } .starry-ticket-copy h3 { font-size:22px; } #enter-starry { width:100%; min-width:0; align-items:center; } #enter-starry strong { font-size:20px; } }
@media (prefers-reduced-motion:reduce) { #enter-starry,#enter-starry:hover,#enter-starry:active { transform:none; transition:none; } }
</style>

<style scoped>
.theater-scene .scene-heading { margin-bottom: 4px; }
.theater-scene .scene-intro { margin: 0 0 16px; color: #654263; }
.theater-scene .scene-controls {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: clamp(6px, 1.5vw, 18px);
  margin-bottom: 12px;
}
.theater-scene .scene-controls button {
  display: grid;
  min-width: 0;
  gap: 5px;
  padding: 5px 5px 7px;
  border-radius: 1px;
  color: #452d49;
  background: #fff5eb;
  border: 1px solid #855f87;
  line-height: 1.28;
}
.theater-scene .scene-controls button[aria-pressed="true"] {
  border: 1px solid #522e57;
  background: #5d3b66;
  color: #fff7ec;
  box-shadow: 2px 3px #31203755;
}
.theater-panel-preview { display: grid; align-items: end; min-width: 0; overflow: hidden; height: clamp(50px, 6.5vw, 87px); background: var(--comic-paper); }
.theater-panel-preview :deep(svg) { width: 100%; height: 100%; }
[data-scene="box"] { --comic-paper: #f8ebd9; }
[data-scene="name"] { --comic-paper: #f5dfe5; }
[data-scene="guitar"] { --comic-paper: #e4cde0; }
.theater-scene .bocchi-theater {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  min-height: 0;
  overflow: hidden;
  border: 2px solid #5b3e57;
  background: var(--comic-paper);
  box-shadow: 5px 7px #b08fb3;
}
.theater-scene .theater-visual {
  position: relative;
  background: transparent;
  border: 0;
  min-height: 0;
}
.theater-scene .theater-visual::after { display: none; }
.theater-visual :deep(svg) { display: block; width: 100%; height: clamp(290px, 31vw, 382px); }
.theater-scene .thought-panel { position: absolute; inset: 50% 6% auto auto; width: min(35%, 340px); padding: 0; transform: translateY(-50%); }
.theater-scene [data-scene="name"] .thought-panel { inset: 56% auto auto 8%; }
.theater-scene [data-scene="guitar"] .thought-panel { inset: 7% 4% auto auto; transform: none; }
.theater-scene .thought-bubble { min-height: 0; padding: 13px 17px; background: #fffaf2; border: 1.5px solid #60435b; box-shadow: 3px 3px #50344921; }
.theater-scene .thought-bubble h3 { margin: 0 0 4px; color: #372437; font-size: clamp(1.06rem, 1.6vw, 1.35rem); }
.theater-scene .thought-bubble p { margin: 0 0 6px; color: #563e53; font-size: .9rem; line-height: 1.55; }
.theater-scene .thought-bubble::before { background: #fffaf2; border-color: #60435b; }
.theater-scene [data-scene="box"] .thought-bubble::before { top: auto; bottom: 22px; left: -8px; }
.theater-scene [data-scene="name"] .thought-bubble::before { left: auto; right: -8px; top: 28px; transform: rotate(225deg); }
.theater-scene [data-scene="guitar"] .thought-bubble::before { top: auto; bottom: -8px; left: 18%; transform: rotate(-45deg); }
.theater-scene .strum-row { margin-top: 12px; }
.theater-scene .strum-status { margin: 0; min-height: 0; }

@media (max-width: 760px) {
  .theater-scene .scene-controls button { font-size: clamp(.68rem, 3vw, .88rem); padding: 3px 3px 6px; }
  .theater-panel-preview { height: clamp(42px, 13vw, 74px); }
  .theater-scene .theater-visual { height: clamp(124px, 42vw, 220px); }
  .theater-visual :deep(svg) { height: 100%; }
  .theater-scene :is([data-scene="name"], [data-scene="guitar"], [data-scene="box"]) .thought-panel {
    position: relative;
    inset: auto;
    width: auto;
    padding: 2px 9px 9px;
    transform: none;
  }
  .theater-scene .thought-bubble { padding: 9px 12px; }
  .theater-scene :is([data-scene="name"], [data-scene="guitar"], [data-scene="box"]) .thought-bubble::before {
    inset: -8px auto auto 32%;
    transform: rotate(135deg);
  }
  .theater-scene [data-scene="name"] .thought-bubble::before { left: 72%; }
  .theater-scene [data-scene="guitar"] .thought-bubble::before { left: 43%; }
}
@media (prefers-reduced-motion: no-preference) {
  html:not([data-motion="reduce"]) .theater-visual :deep(svg) { animation: page-ink-in .18s ease both; }
  @keyframes page-ink-in { from { opacity: .64; } to { opacity: 1; } }
}
</style>
