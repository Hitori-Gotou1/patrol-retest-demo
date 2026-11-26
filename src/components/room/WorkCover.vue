<script setup>
import { computed } from 'vue';
import { workTypes } from '../../room/workshelf.js';
import { effectNames } from '../../room/effects.js';
import { patternBars, studioTracks } from '../../room/pattern.js';

const props = defineProps({ work: { type: Object, required: true } });
const bar = computed(() => props.work.kind === 'studio' ? patternBars(props.work.snapshot)[0] : null);
const scoreLabel = computed(() => {
  if (!bar.value) return '';
  const beats = studioTracks.map((track, i) => {
    const positions = Array.from({ length: 16 }, (_, step) => step + 1)
      .filter(step => bar.value.masks[i] & (1 << (step - 1)));
    return track.label + ' ' + (positions.join('、') || '休止');
  });
  return bar.value.name + ' / ' + beats.join('，');
});
const tone = computed(() => props.work.kind === 'effects' && !props.work.legacyCover ? props.work.snapshot : null);
</script>

<template>
  <figure class="work-cover" :class="{ 'work-cover-art': work.preview, 'work-cover-music': !work.preview && (bar || tone) }">
    <img v-if="work.preview" :src="work.preview" :alt="work.title + '的保存预览'" loading="lazy">
    <div v-else-if="bar" class="work-score" role="img" :aria-label="scoreLabel">
      <div class="work-cover-heading"><span>{{ bar.name }}</span><span>{{ work.snapshot.bpm }} BPM</span></div>
      <div v-for="(track, index) in studioTracks" :key="track.id" class="work-score-row">
        <span>{{ track.label }}</span>
        <i v-for="step in 16" :key="step" :class="{ 'is-beat': bar.masks[index] & (1 << (step - 1)) }"></i>
      </div>
    </div>
    <div v-else-if="tone" class="tone-cover">
      <div class="work-cover-heading"><span>吉他音色</span><span>信号 →</span></div>
      <ol aria-label="音色接线顺序">
        <li v-for="id in tone.order" :key="id" :data-effect="id" :data-active="tone.enabled[id]">
          <span aria-hidden="true" class="tone-cover-dial"></span>
          <strong>{{ effectNames[id] }}</strong>
          <span>{{ tone.enabled[id] ? '接通' : '旁通' }}</span>
        </li>
      </ol>
    </div>
    <div v-else class="work-cover-plain">
      <span>{{ workTypes[work.kind].label }}</span>
      <strong>{{ work.title }}</strong>
    </div>
  </figure>
</template>

<style scoped>
.work-cover { margin:0; min-width:0; border-bottom:1px solid #b49c87; background:#eedac4; display:grid; align-items:center; }
.work-cover-art { padding:8px; background:#e6d2c4; }
.work-cover img { display:block; width:100%; height:auto; max-height:260px; object-fit:contain; }
.work-cover-music { background:#302736; color:#fff4de; }
.work-score,.tone-cover { padding:clamp(9px,2vw,20px); min-width:0; }
.work-cover-heading { display:flex; justify-content:space-between; gap:5px; margin-bottom:12px; color:#f6e0cc; font-size:11px; overflow-wrap:anywhere; }
.work-score-row { display:grid; grid-template-columns:26px repeat(16,minmax(0,1fr)); align-items:center; gap:2px; margin-bottom:3px; }
.work-score-row span { font-size:10px; }
.work-score-row i { aspect-ratio:.86; min-height:4px; border:1px solid #887284; background:#433448; }
.work-score-row i:nth-of-type(4n+1) { border-left:1px solid #d9be9f; }
.work-score-row i.is-beat { background:#e8b3bc; border-color:#f2d4bc; }
.work-score-row:nth-child(3) i.is-beat { background:#afc7da; }
.work-score-row:nth-child(4) i.is-beat { background:#dec28b; }
.work-score-row:nth-child(5) i.is-beat { background:#abc8b6; }
.tone-cover ol { list-style:none; display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:clamp(8px,2vw,20px); margin:0; padding:0; }
.tone-cover li { --pedal:#d4a5bb; position:relative; display:grid; justify-items:center; text-align:center; border:1px solid #f0d3bd; background:var(--pedal); color:#342634; gap:3px; padding:7px 1px; font-size:10px; border-radius:3px; }
.tone-cover li[data-effect='delay'] { --pedal:#b7cedb; }
.tone-cover li[data-effect='reverb'] { --pedal:#e1c593; }
.tone-cover li[data-active='false'] { background:#4a3e4e; border-style:dashed; color:#f1dcca; }
.tone-cover li+li::before { content:""; position:absolute; top:50%; right:100%; width:clamp(8px,2vw,20px); height:3px; background:#e3c1a1; }
.tone-cover-dial { width:15px; height:15px; border-radius:50%; border:2px solid currentColor; position:relative; }
.tone-cover-dial::before { content:""; position:absolute; width:1px; height:5px; top:0; left:5px; background:currentColor; transform-origin:bottom; transform:rotate(30deg); }
.tone-cover strong { font-size:13px; white-space:nowrap; }
.work-cover-plain { min-height:112px; padding:16px; display:grid; align-content:center; gap:8px; color:#563b45; border-left:7px solid #9c6d76; }
.work-cover-plain span { font-size:12px; }
.work-cover-plain strong { font-size:16px; overflow-wrap:anywhere; }
</style>
