<script setup>
import { computed } from 'vue';
import { aftershowArtViews } from '../../../room/aftershowArt.js';
import AftershowStageArt from './AftershowStageArt.vue';

const props = defineProps({
  view: { type: String, required: true },
  beat: { type: Number, required: true },
  playing: Boolean,
  reduced: Boolean
});
const emit = defineEmits(['select-view', 'select-beat', 'toggle-play', 'print']);
const positionColors = { audience: '#ee9bbf', guitar: '#ef807a', drums: '#f2ce83', wing: '#a3bee5' };
const viewpoints = Object.entries(aftershowArtViews).map(([id, position]) => ({
  id, label: position.label, color: positionColors[id]
}));
const moments = ['灯光还没亮满', '鞋尖轻轻点地', '所有人吸一口气', '下一拍就要落下', '一拍没有落下', '鼓棒给出提示', '两个人接住节奏', '四个人一起落下'];
const details = {
  audience: [
    '四个人站在同一束暖光里。', '台前的鞋尖先挪了半步。', '她们把乐器举到同一条线上。', '四个人都在等第一个和弦。',
    '一里的手先停住，其余三个人也把这一拍留空。', '靠后的虹夏抬起鼓棒，其他人仍然留着那一拍。', '凉和喜多先把身体转向鼓声。', '拨弦、鼓面和麦克风在同一个瞬间接上。'
  ],
  guitar: [
    '指尖捏着粉色拨片，离琴弦还有一点距离。', '鞋尖在地板上点过一下，拨片还没有碰到弦。', '前臂抬起时，六根弦在灯下各有一条线。', '拨片几乎贴上第一根弦。',
    '拨片停在弦外，弦依然是直的。', '听到鼓棒的提示，手腕放下来一点。', '一里的拇指松开了刚才一直捏紧的拨片。', '拨片划过琴弦，六条亮线一起颤了一下。'
  ],
  drums: [
    '鼓棒悬在鼓面上，镲片还没有晃动。', '右鼓棒略低，用手腕默默数拍。', '两支鼓棒一高一低，预备把合奏带进来。', '棒尖缩短了和鼓面的距离。',
    '左棒停下来，虹夏把落点留给一里。', '左鼓棒抬高，右棒斜向镲片，把下一拍给大家看。', '右棒回到鼓面上方，左手开始跟进。', '鼓面上的圈和镲片一起振开。'
  ],
  wing: [
    '幕布挡住半个舞台，凉和喜多站在光的边缘。', '音箱边只看得见一里的鞋尖挪了挪。', '喜多把身体侧向凉，留出一点位置。', '两人的肩膀朝向台前，眼睛还看着自己的位置。',
    '远处的一里停了，凉把眼睛移向喜多。', '帘边看得见虹夏举手，凉和喜多还没有转回去。', '两人隔着音箱对看了一眼，才一同朝向台前。', '她们一同转回，边幕外的四个人接成一拍。'
  ]
};
const active = computed(() => viewpoints.find(position => position.id === props.view) || viewpoints[0]);
const description = computed(() => details[active.value.id][props.beat - 1]);

function moveView(event, index) {
  const next = event.key === 'ArrowLeft' ? index - 1 : event.key === 'ArrowRight' ? index + 1 : null;
  if (next === null) return;
  event.preventDefault();
  const wrapped = (next + viewpoints.length) % viewpoints.length;
  emit('select-view', viewpoints[wrapped].id);
  event.currentTarget.parentElement.children[wrapped]?.focus();
}

function moveBeat(event, beat) {
  const next = event.key === 'ArrowLeft' ? beat - 1 : event.key === 'ArrowRight' ? beat + 1 : null;
  if (next === null) return;
  event.preventDefault();
  if (next < 1 || next > 8) return;
  emit('select-beat', next);
  event.currentTarget.parentElement.children[next - 1]?.focus();
}
</script>

<template>
  <section class="aftershow-stage" :data-aftershow-reduced="reduced" aria-labelledby="aftershow-stage-title">
    <div class="aftershow-stage-layout">
      <figure class="aftershow-stage-figure">
        <div class="aftershow-stage-frame" :data-view="view" :data-beat="beat" :style="{ '--position-color': active.color }">
          <AftershowStageArt :view="view" :beat="beat" />
          <div class="aftershow-camera" aria-hidden="true"><span><i></i>{{ active.label }}</span><span>第 {{ beat }} / 8 拍</span></div>
        </div>
        <figcaption class="aftershow-frame-caption" :aria-live="playing ? 'off' : 'polite'">
          <strong>{{ moments[beat - 1] }}</strong><span>{{ description }}</span>
        </figcaption>
      </figure>
      <div class="aftershow-stage-console">
        <div class="aftershow-stage-intro">
          <h2 id="aftershow-stage-title" tabindex="-1">同一拍，四个位置</h2>
          <p>一段原创舞台分镜。换个位置，看看这一拍的另一面。</p>
        </div>
        <div class="aftershow-view-controls">
          <p id="aftershow-view-label">换个位置看</p>
          <div class="aftershow-view-list" role="group" aria-labelledby="aftershow-view-label">
            <button v-for="(position,index) in viewpoints" :key="position.id" type="button" class="aftershow-view-button"
              :data-aftershow-view="position.id" :aria-pressed="view===position.id" :style="{ '--position-color': position.color }"
              @click="emit('select-view', position.id)" @keydown="moveView($event,index)">
              <span class="aftershow-view-dot" aria-hidden="true"></span>{{ position.label }}
            </button>
          </div>
        </div>
        <div class="aftershow-time-controls">
          <div class="aftershow-playback" role="group" aria-label="八拍播放控制">
            <button class="aftershow-skip-beat" type="button" aria-label="上一拍" :disabled="beat<=1" @click="emit('select-beat', beat - 1)">‹</button>
            <button type="button" class="aftershow-play" @click="emit('toggle-play')"><span aria-hidden="true">{{ playing ? '‖' : '▶' }}</span>{{ playing ? '暂停播放' : '播放八拍' }}</button>
            <button class="aftershow-skip-beat" type="button" aria-label="下一拍" :disabled="beat>=8" @click="emit('select-beat', beat + 1)">›</button>
          </div>
          <div class="aftershow-beat-list" role="group" aria-label="直接选拍">
            <button v-for="n in 8" :key="n" type="button" :data-aftershow-beat="n" :aria-label="`第 ${n} 拍`" :aria-pressed="n===beat" :title="moments[n-1]" @click="emit('select-beat', n)" @keydown="moveBeat($event,n)">{{ n }}</button>
          </div>
        </div>
        <button type="button" class="aftershow-send-to-print" @click="emit('print')">把这一拍印下来 <span aria-hidden="true">↗</span></button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.aftershow-stage{color:#f5e1da;min-width:0;--stage-edge:#76586e;--stage-gold:#f4cc8b;--stage-pink:#f0a9c6}
.aftershow-stage-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(254px,285px);align-items:start;gap:24px}
.aftershow-stage-figure{margin:0;min-width:0}
.aftershow-stage-frame{position:relative;overflow:hidden;background:#221b2c;border:1px solid var(--stage-edge);box-shadow:0 12px 30px #0906104d}
.aftershow-camera{position:absolute;left:4.3%;top:7%;right:4.3%;display:flex;justify-content:space-between;align-items:start;gap:8px;pointer-events:none;font:600 clamp(.61rem,1.2vw,.75rem)/1.35 var(--mono,monospace);color:#ffdfc9;letter-spacing:.08em}
.aftershow-camera span{display:flex;gap:6px;align-items:center;background:#171321d9;padding:4px 7px;border:1px solid #855e75}
.aftershow-camera i{width:6px;height:6px;border-radius:50%;background:var(--position-color);box-shadow:0 0 8px var(--position-color)}
.aftershow-frame-caption{display:grid;align-items:start;min-height:58px;grid-template-columns:auto 1fr;gap:12px;padding:13px 11px 10px;border-bottom:1px solid #72576a;color:#dec7cc;font-size:.84rem;line-height:1.55}
.aftershow-frame-caption strong{color:var(--stage-gold);font-size:.92rem}
.aftershow-stage-console{display:grid;gap:16px;min-width:0;padding:15px;border:1px solid #6a5266;background:#2a2030;box-shadow:3px 4px 0 #15101c}
.aftershow-stage-intro h2{margin:0;font-size:clamp(1.15rem,2vw,1.54rem);line-height:1.34;color:#f7e7d9;letter-spacing:.02em}
.aftershow-stage-intro p{margin:6px 0 0;color:#cfb4c4;font-size:.8rem;line-height:1.6}
.aftershow-view-controls p{margin:0 0 7px;font-size:.8rem;font-weight:650;color:#efd4cd}
.aftershow-view-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}
.aftershow-stage-console button{min-width:0;min-height:40px;font:inherit;font-size:.78rem;border:1px solid #886478;border-radius:2px;background:#34263b;color:#f4e2db;padding:4px 5px;line-height:1.25;white-space:normal;touch-action:manipulation}
.aftershow-stage-console button:hover:not(:disabled){background:#53394a;border-color:#b18c9d}
.aftershow-stage-console button:focus-visible{outline:2px solid #ffd39a;outline-offset:2px;position:relative;z-index:1}
.aftershow-stage-console button:disabled{color:#ac8d9f;background:#291f31;border-color:#5f495a;opacity:1;cursor:default}
.aftershow-stage-console .aftershow-view-button{display:flex;gap:7px;align-items:center;justify-content:center;font-weight:600}
.aftershow-view-dot{width:7px;height:7px;flex:none;border-radius:50%;background:var(--position-color)}
.aftershow-stage-console .aftershow-view-button[aria-pressed=true]{border-color:var(--position-color);background:#57394f;color:#fff3eb;box-shadow:inset 0 -2px var(--position-color)}
.aftershow-time-controls{display:grid;gap:6px}
.aftershow-playback{display:grid;grid-template-columns:42px 1fr 42px;gap:5px}
.aftershow-stage-console .aftershow-skip-beat{font-size:1.4rem;line-height:1}
.aftershow-stage-console .aftershow-play{font-weight:750;background:#473148;color:#fff0e7}
.aftershow-play span{margin-inline-end:7px;font-size:.72rem;color:var(--stage-gold)}
.aftershow-beat-list{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:3px}
.aftershow-beat-list button{padding:1px;font:700 .74rem/1 var(--mono,monospace)}
.aftershow-beat-list button[aria-pressed=true]{background:var(--stage-gold);border-color:var(--stage-gold);color:#28202e;box-shadow:inset 0 -2px #9a654b}
.aftershow-stage-console .aftershow-send-to-print{background:var(--stage-pink);border-color:var(--stage-pink);font-size:.9rem;color:#382133;font-weight:750;min-height:44px}
.aftershow-stage-console .aftershow-send-to-print:hover{background:#ffc3d8;color:#311d2d}
.aftershow-send-to-print span{display:inline-block;margin-inline-start:8px}
@media(max-width:760px){
 .aftershow-stage-layout{grid-template-columns:minmax(0,1fr);gap:11px}
 .aftershow-stage-console{gap:11px;padding:10px}
 .aftershow-stage-console button{min-height:44px}
 .aftershow-view-list{grid-template-columns:repeat(4,minmax(0,1fr));gap:4px}
 .aftershow-stage-console .aftershow-view-button{gap:4px;font-size:.72rem}
 .aftershow-frame-caption{gap:6px 10px;padding:8px 5px;min-height:62px;grid-template-columns:1fr;font-size:.77rem;line-height:1.39}
 .aftershow-frame-caption strong{font-size:.83rem}
 .aftershow-stage-intro p{font-size:.76rem;margin-block-start:3px}
 .aftershow-camera{top:6%}
 .aftershow-camera span{padding:3px 5px}
}
</style>
