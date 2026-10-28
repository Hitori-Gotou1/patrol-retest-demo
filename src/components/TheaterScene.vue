<script setup>
import { ref, computed, shallowRef, onBeforeUnmount } from 'vue';
import { useChord } from '../composables/useChord.js';
import { interactionFeatures } from '../data/interactions.js';
import { liveModeActive } from '../composables/useInteractionSession.js';
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
    <section class="theater-scene scene" id="theater" data-scene-name="纸箱剧场" aria-labelledby="theater-title">
      <div class="scene-inner">
        <div class="scene-heading"><div><span class="scene-kicker">03 / 社交电量充电站</span><h2 id="theater-title">嘘，纸箱里有人。</h2></div><span class="theater-sticker">本人很安静<br><strong>脑内很热闹！</strong></span></div>
        <p class="scene-intro">如果此刻是一里，她的脑内小剧场大概已经开演了。</p>
      <div class="theater-section">

        <div class="scene-controls" role="group" aria-label="选择脑内小剧场情境"><button v-for="(scene, id) in scenes" :key="id" type="button" :data-scene="id" :aria-pressed="selected === id" :class="{active:selected === id}" @click="selected = id">{{ scene.label }}</button></div>
        <div class="bocchi-theater" id="bocchi-theater" :data-scene="selected">
          <div class="theater-visual" aria-hidden="true">
            <div class="manga-ray ray-one"></div><div class="manga-ray ray-two"></div><span class="manga-symbol">…</span>
            <div class="bocchi-doodle"><div class="doodle-hair"><span class="doodle-clips"><i></i><i></i></span><div class="doodle-face"><i class="eye eye-left"></i><i class="eye eye-right"></i><i class="blush blush-left"></i><i class="blush blush-right"></i><i class="mouth"></i></div><div class="doodle-fringe"></div></div><div class="doodle-body"><span></span><span></span></div></div>
            <div class="cardboard-box"><span class="box-tape"></span><span class="box-label">ぼっち 在此</span><span class="box-arrows">↑↑</span></div>
            <div class="tiny-guitar"><span class="guitar-neck"></span><span class="guitar-body"></span><span class="guitar-strings"></span></div>
          </div>
          <div class="thought-panel"><div class="thought-bubble" role="status" aria-live="polite" aria-atomic="true"><h3 id="thought-title">{{ current.title }}</h3><p id="thought-text">{{ current.text }}</p><span id="scene-note">{{ current.note }}</span></div><div class="strum-row"><button id="strum-button" class="strum-button" :data-playing="playing || undefined" @click="play" type="button"><span class="string-icon" aria-hidden="true">≋</span><span id="strum-label">听一声和弦</span><span aria-hidden="true">♪</span></button><span class="sound-hint">轻轻拨一下，只响一小段</span></div><p class="strum-status" id="strum-status" role="status" aria-live="polite">{{ message }}</p></div>
        </div>
      </div>
      <details class="growth-note"><summary><span><span class="growth-dot" aria-hidden="true"></span> 从房间到舞台，那些很小、很重要的变化</span><span class="details-symbol" aria-hidden="true">＋</span></summary><ol><li><strong>一个人，也认真练习。</strong><p>在房间里反复磨练技巧，在网络上以「吉他英雄」的身份分享演奏。</p></li><li><strong>有人邀请，就试着迈一步。</strong><p>虹夏的出现，让一个人的吉他声有了与鼓、贝斯和歌声相遇的机会。</p></li><li><strong>带着紧张，继续站上舞台。</strong><p>信心没有突然变满。但她开始为了伙伴，尝试把练习过的声音真正弹出来。</p></li></ol></details>
      <div v-if="interactionFeatures.liveMode" class="starry-ticket">
        <div class="starry-ticket-copy"><span>ONE NIGHT / FOUR COLORS</span><h3>房间之外，舞台之上。</h3><p>灯光就位。今晚的 STARRY，也为你留了位置。</p></div>
        <button id="enter-starry" ref="liveEntry" type="button" :disabled="liveLoading" :aria-busy="liveLoading" @click="enterLive"><small>LIVE HOUSE / 下北沢</small><strong>{{ liveLoading ? '准备舞台…' : 'ENTER STARRY' }} <span aria-hidden="true">↗</span></strong><span class="starry-ticket-tear" aria-hidden="true"></span></button>
        <p v-if="liveMessage" class="starry-entry-status" role="status">{{ liveMessage }}</p>
      </div>
        <span class="theater-doodle-note" aria-hidden="true">今日任务：再勇敢一点点。 ↖</span>
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
