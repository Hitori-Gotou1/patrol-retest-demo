<script setup>
import { computed } from 'vue';
import { rhythmLanes } from '../../room/rhythm.js';

const props = defineProps({ round:{ type:Object,required:true } });
const ticks = [-180,-90,0,90,180];
const position = value => (value + 180) / 3.6 + '%';
const signed = value => value > 0 ? '+' + value : value < 0 ? '−' + Math.abs(value) : '0';
const rows = computed(() => rhythmLanes.map((lane,index) => {
  const notes = props.round.notes.filter(note => note.lane === index);
  const exact = notes.filter(note => Number.isFinite(note.deviation));
  const oneMillisecond = new Map();
  for (const note of exact) {
    const key = Math.round(note.deviation);
    if (!oneMillisecond.has(key)) oneMillisecond.set(key,[]);
    oneMillisecond.get(key).push(note.deviation);
  }
  const points = [...oneMillisecond.entries()].map(([ms,values]) => ({
    ms, x:values.reduce((sum,value) => sum + value,0) / values.length, count:values.length
  }));
  const early = exact.filter(note => note.deviation < -15).length;
  const late = exact.filter(note => note.deviation > 15).length;
  const miss = notes.filter(note => note.judgment === 'Miss').length;
  const stray = props.round.strayByLane?.[index] || 0;
  return { lane,index,points,early,late,near:exact.length - early - late,miss,stray };
}));
const misses = computed(() => rows.value.reduce((sum,row) => sum + row.miss,0));
</script>

<template>
  <figure class="timing-paper" aria-label="四轨击打落点">
    <figcaption>早按 ← <span>实际偏差（毫秒）</span> → 晚按</figcaption>
    <div class="timing-axis" aria-hidden="true">
      <span v-for="tick in ticks" :key="tick" :style="{left:position(tick)}">{{ signed(tick) }}</span>
    </div>
    <ol class="timing-lanes">
      <li v-for="row in rows" :key="row.lane.key" :data-timing-lane="row.index" :style="{ '--track':row.lane.color }">
        <strong class="timing-name">{{ row.lane.label }}</strong>
        <span class="visually-hidden">早按 {{ row.early }} 次，落点附近 {{ row.near }} 次，晚按 {{ row.late }} 次，漏按 {{ row.miss }} 次，空拍 {{ row.stray }} 次。</span>
        <div class="timing-field" aria-hidden="true">
          <i class="timing-middle"></i>
          <span v-for="point in row.points" :key="point.ms" class="timing-hit" :data-error="point.ms" :data-count="point.count"
            :style="{ left:position(point.x) }" :title="`${signed(point.ms)} 毫秒 · ${point.count} 次`">
            <small v-if="point.count>1">{{ point.count }}</small>
          </span>
        </div>
      </li>
    </ol>
    <dl class="timing-unmapped">
      <div><dt>漏按</dt><dd>{{ misses }} 次</dd></div>
      <div><dt>空拍</dt><dd>{{ round.stray }} 次</dd></div>
    </dl>
  </figure>
</template>

<style scoped>
.timing-paper { --label-w:114px; background:#fff4de; border:1px solid #bca29e; padding:12px; margin:10px 0; }
.timing-paper figcaption { display:flex; justify-content:space-between; align-items:baseline; gap:5px; color:#69475c; font-size:12px; }
.timing-paper figcaption span { color:#4e3745; font-weight:700; }
.timing-axis { position:relative; margin:6px 15px 0 calc(var(--label-w) + 15px); height:23px; font:11px var(--mono,monospace); color:#624555; }
.timing-axis span { position:absolute; transform:translateX(-50%); white-space:nowrap; }
.timing-lanes { list-style:none; margin:0; padding:0; }
.timing-lanes li { min-width:0; display:grid; grid-template-columns:var(--label-w) minmax(0,1fr); align-items:stretch; border-top:1px solid #ccb7ad; min-height:42px; }
.timing-lanes li:last-child { border-bottom:1px solid #ccb7ad; }
.timing-name { display:flex; align-items:center; border-left:4px solid var(--track); padding:5px 6px; font-size:12px; }
.timing-field { position:relative; margin-inline:15px; background:repeating-linear-gradient(90deg,#ae95a025 0 1px,transparent 1px 25%); border-right:1px solid #ae95a025; }
.timing-middle { position:absolute; inset:0 45.8333%; background:#e6d3c1; }
.timing-middle::after { content:''; position:absolute; left:50%; height:100%; border-left:1px solid #6e4d62; }
.timing-hit { position:absolute; top:55%; width:8px; height:8px; transform:translate(-50%,-50%); border:1px solid #544051; border-radius:50%; background:var(--track); opacity:.86; mix-blend-mode:multiply; }
.timing-hit[data-count]:not([data-count="1"]) { width:11px; height:11px; box-shadow:0 0 0 2px #62516945; }
.timing-hit small { position:absolute; left:50%; bottom:100%; margin-bottom:3px; transform:translateX(-50%); font:700 10px var(--mono,monospace); color:#4c3347; }
.timing-unmapped { display:flex; flex-wrap:wrap; gap:8px 20px; margin:9px 0 0; }
.timing-unmapped>div { display:flex; align-items:baseline; gap:6px; font-size:13px; }
.timing-unmapped dd { margin:0; font-variant-numeric:tabular-nums; font-weight:700; }
@media(max-width:550px) {
  .timing-paper { --label-w:70px; padding:9px 5px; }
  .timing-name { font-size:11px; padding-inline:4px; }
  .timing-paper figcaption { font-size:10px; }
}
</style>
