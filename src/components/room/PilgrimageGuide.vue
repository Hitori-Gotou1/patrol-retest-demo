<script setup>
import {computed,ref} from 'vue';
import {pilgrimagePoints,pilgrimageLicense} from '../../data/pilgrimage.js';
import {loadLocal,saveLocal,downloadJson} from '../../room/storage.js';
const selected=ref(pilgrimagePoints[0].id),unavailable=ref([]),message=ref('');
const bookmarks=ref(loadLocal('hitori-room:pilgrimage:v1',[],v=>{if(!Array.isArray(v))throw new Error();return v.filter(id=>pilgrimagePoints.some(p=>p.id===id));}));
const point=computed(()=>pilgrimagePoints.find(p=>p.id===selected.value));
const mapLink=p=>'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(p.title+' '+p.address);
function bookmark(p){bookmarks.value=bookmarks.value.includes(p.id)?bookmarks.value.filter(id=>id!==p.id):[...bookmarks.value,p.id];message.value=saveLocal('hitori-room:pilgrimage:v1',bookmarks.value)?'想去的地点已保存在本机。':'本机暂不能保存，可导出路线清单。';}
function exportRoute(){downloadJson({title:'一里小屋 · 下北泽巡礼清单',checked:'2026-11-13',places:pilgrimagePoints.filter(p=>!bookmarks.value.length||bookmarks.value.includes(p.id)).map(p=>({name:p.title,address:p.address,map:mapLink(p),source:p.source,comparison:p.mapUrl}))},'hitori-pilgrimage-route.json');message.value='已导出地点、地图与来源链接，方便出发前整理。';}
const pointIndex = computed(() => pilgrimagePoints.findIndex(p => p.id === selected.value));
function imageFailed(event) {
  const id = event.currentTarget.dataset.pointId;
  if (!unavailable.value.includes(id)) unavailable.value.push(id);
}
const time=s=>`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
</script>
<template>
  <section class="room-panel pilgrimage-room" aria-labelledby="pilgrimage-title">
    <header class="activity-title">
      <p class="play-eyebrow">下北泽巡礼取景册</p>
      <h2 id="pilgrimage-title">从车站走到舞台。</h2>
      <p class="room-intro">三处真实地点，沿着画面慢慢走。地址核对于 2026-11-13。</p>
    </header>
    <div class="pilgrimage-album">
      <article class="resource-card pilgrimage-page" aria-labelledby="pilgrimage-stop">
        <header class="viewfinder-heading">
          <span>第 {{ pointIndex + 1 }} / 3 站</span>
          <h3 id="pilgrimage-stop">{{ point.title }}</h3>
        </header>
        <figure class="viewfinder">
          <div class="viewfinder-frame">
            <img v-if="!unavailable.includes(point.id)" :key="point.id" :data-point-id="point.id"
              :src="point.image" :alt="point.title + '在动画中的取景截图'" width="320" height="180" @error="imageFailed">
            <div v-else class="viewfinder-missing">
              <strong>{{ point.title }}</strong>
              <span>动画第 {{ point.ep }} 集 · Anitabi / {{ point.origin }}</span>
              <a :href="point.mapUrl" target="_blank" rel="noopener noreferrer">打开原站取景画面 ↗</a>
            </div>
          </div>
          <figcaption class="source-label">动画第 {{ point.ep }} 集 · {{ time(point.s) }} 附近 · 取景资料署名：{{ point.origin }}</figcaption>
        </figure>
        <address>{{ point.address }}</address>
        <div class="resource-actions viewfinder-actions">
          <a :href="mapLink(point)" target="_blank" rel="noopener noreferrer">地图导航 ↗</a>
          <a :href="point.mapUrl" target="_blank" rel="noopener noreferrer">动画 / 实景对照 ↗</a>
          <button type="button" :aria-pressed="bookmarks.includes(point.id)" @click="bookmark(point)">{{ bookmarks.includes(point.id) ? '已记下，想去 ✓' : '记下这个地点 ＋' }}</button>
        </div>
        <details class="viewfinder-details">
          <summary>本站说明与来源</summary>
          <p class="viewfinder-note">{{ point.note }}</p>
          <div class="viewfinder-sources">
            <a :href="point.source" target="_blank" rel="noopener noreferrer">运营方资料 ↗</a>
            <a :href="point.originURL || point.originLink || point.mapUrl" target="_blank" rel="noopener noreferrer">取景原始来源 ↗</a>
          </div>
        </details>
      </article>
      <nav class="pilgrimage-route" aria-label="巡礼三站">
        <h3>路线示意</h3>
        <ol>
          <li v-for="(place, i) in pilgrimagePoints" :key="place.id" :class="{ 'is-here': selected === place.id }">
            <button type="button" :aria-pressed="selected === place.id" aria-label="查看这一站 →" :aria-describedby="'route-' + place.id"
              @click="selected = place.id">
              <span class="route-number">{{ i + 1 }}</span>
              <span :id="'route-' + place.id">{{ place.title }}</span>
              <svg v-if="bookmarks.includes(place.id)" class="route-bookmark" viewBox="0 0 16 20" role="img" aria-label="已记下"><path d="M2 1h12v18l-6-4-6 4z" fill="currentColor"/></svg>
            </button>
          </li>
        </ol>
        <a href="https://www.anitabi.cn/map?bangumiId=328609" target="_blank" rel="noopener noreferrer">打开完整巡礼地图 ↗</a>
        <button type="button" @click="exportRoute">导出{{ bookmarks.length ? '想去的地点' : '路线清单' }} JSON ↓</button>
        <p class="room-status" role="status">{{ message }}</p>
      </nav>
    </div>
    <p class="room-hint viewfinder-credit">取景资料来自 <a href="https://navi.anitabi.cn/docs/api/" target="_blank" rel="noopener noreferrer">Anitabi</a>，按 <a :href="pilgrimageLicense" target="_blank" rel="noopener noreferrer">CC BY-NC-SA 4.0</a> 标注来源。营业、通行与拍摄安排请以运营方资料为准。</p>
  </section>
</template>

<style scoped>
.pilgrimage-album { display:grid; grid-template-columns:clamp(190px,22vw,246px) minmax(0,1fr); gap:clamp(12px,3vw,37px); align-items:start; }
.pilgrimage-page { grid-column:2; grid-row:1; display:grid; padding:clamp(10px,2.1vw,24px); min-width:0; background:#fff9ee; border:1px solid #b8a58e; box-shadow:0 5px 12px #63452b14; }
.viewfinder-heading { display:flex; flex-wrap:wrap; align-items:baseline; column-gap:12px; margin:0 0 9px; }
.viewfinder-heading span { color:#794b56; font-size:12px; white-space:nowrap; font-variant-numeric:tabular-nums; }
.viewfinder-heading h3 { font-size:clamp(19px,2.5vw,29px); color:#3f343a; margin:0; overflow-wrap:anywhere; }
.viewfinder { margin:0; min-width:0; }
.viewfinder-frame { aspect-ratio:16/9; display:grid; place-items:center; border:6px solid #342933; background:#392f3a; overflow:hidden; }
.viewfinder-frame img { width:100%; height:100%; object-fit:contain; display:block; }
.viewfinder-missing { display:grid; justify-items:center; text-align:center; gap:3px; color:#fff1de; padding:10px; }
.viewfinder-missing span { font-size:12px; }
.viewfinder-missing a { display:grid; align-content:center; min-height:44px; font-size:13px; text-underline-offset:3px; color:#ffdfbb; }
.viewfinder figcaption { color:#68504c; font-size:12px; padding:5px 0 8px; border-bottom:1px solid #d7c6ad; }
.pilgrimage-page address { font-style:normal; margin-top:9px; color:#51404a; }
.viewfinder-actions { margin:10px 0 0; gap:5px 10px; align-items:center; }
.viewfinder-details { border-top:1px solid #d6c3aa; margin-top:6px; }
.viewfinder-details summary { min-height:44px; padding:10px 1px 5px; color:#654557; cursor:pointer; font-size:12px; }
.viewfinder-note { font-size:13px; margin:8px 0 0; }
.viewfinder-sources { display:flex; flex-wrap:wrap; column-gap:14px; font-size:12px; }
.viewfinder-sources a,.pilgrimage-route>a { min-height:44px; display:inline-flex; align-items:center; color:#674759; text-underline-offset:3px; }
.pilgrimage-route { grid-column:1; grid-row:1; position:sticky; top:113px; padding:14px 12px; border:1px solid #c7b798; background:#eee4cd; }
.pilgrimage-route h3 { margin:0 0 8px; color:#584839; font-size:13px; }
.pilgrimage-route ol { list-style:none; padding:0; margin:0; position:relative; }
.pilgrimage-route ol::before { content:""; position:absolute; top:24px; bottom:24px; left:23px; border-left:2px dashed #9b786e; }
.pilgrimage-route li+li { margin-top:6px; }
.pilgrimage-route li button { display:grid; grid-template-columns:30px minmax(0,1fr) auto; width:100%; align-items:center; gap:7px; min-height:55px; color:#4b3942; background:transparent; border-color:transparent; text-align:left; padding:6px 8px; overflow-wrap:anywhere; }
.pilgrimage-route li.is-here button { background:#fcf3df; border-color:#b69a84; }
.route-number { width:30px; height:30px; position:relative; z-index:1; display:grid; place-items:center; border-radius:50%; color:#623c50; background:#fffaef; border:1px solid #8d6375; font:700 14px var(--mono,monospace); }
.is-here .route-number { color:#fff7ed; background:#814d67; }
.route-bookmark { width:12px; height:15px; color:#72445d; }
.pilgrimage-route>a { font-size:12px; }
.viewfinder-credit { margin:14px 0 0; }
@media(max-width:760px) {
  .pilgrimage-album { grid-template-columns:minmax(0,1fr); gap:10px; }
  .pilgrimage-page,.pilgrimage-route { grid-area:auto; }
  .viewfinder-frame { border-width:4px; }
  .pilgrimage-page address { grid-row:2; margin:0 0 8px; font-size:13px; }
  .viewfinder-heading { min-height:43px; align-content:start; margin-bottom:3px; }
  .viewfinder-heading h3 { font-size:17px; }
  .pilgrimage-route { position:static; padding:8px; }
  .pilgrimage-route ol { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:3px; }
  .pilgrimage-route ol::before { top:22px; left:14%; right:14%; bottom:auto; border:0; border-top:2px dashed #9b786e; }
  .pilgrimage-route li+li { margin:0; }
  .pilgrimage-route li button { grid-template-columns:minmax(0,1fr); align-content:start; justify-items:center; font-size:11px; line-height:1.4; text-align:center; min-height:86px; padding:6px 2px; gap:4px; }
  .route-bookmark { width:9px; height:11px; }
  .viewfinder-sources a { font-size:12px; }
}
@media(max-width:400px) { .pilgrimage-page address { min-height:24px; } }
</style>
