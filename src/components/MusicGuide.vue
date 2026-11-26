<script setup>
import { listeningSelections, officialAlbum, officialListening } from '../data/editorial.js';
</script>

<template>
  <section class="listening-guide" aria-labelledby="listening-title">
    <div class="listening-heading">
      <div><h3 id="listening-title">从四首歌开始，听见结束乐队。</h3><p>先听喜欢的声音，再慢慢认识合奏。以下为本站原创导听文字。</p></div>
      <a :href="officialListening" target="_blank" rel="noopener noreferrer">去官方平台收听</a>
    </div>
    <div class="listening-grid">
      <article v-for="(song,index) in listeningSelections" :key="song.title" :style="{ '--song-color': song.color }">
        <div class="listening-number" :aria-label="`第 ${index+1} 曲`">{{ String(index+1).padStart(2,'0') }}</div>
        <div>
          <p class="listening-caption">{{ song.caption }}</p>
          <h4>{{ song.title }}</h4>
          <p class="listening-focus">这一遍，听听{{ song.focus }}</p>
          <p class="listening-description">{{ song.text }}</p>
          <RouterLink :to="`/room/notes/${song.article}`">读完整听歌札记</RouterLink>
        </div>
      </article>
    </div>
    <div class="listening-footer">
      <a :href="officialAlbum" target="_blank" rel="noopener noreferrer">曲目资料 · 官方专辑页</a>
      <RouterLink to="/room/ambient">在雨夜 STARRY 坐坐</RouterLink>
    </div>
  </section>
</template>

<style scoped>
.listening-guide {
  padding: clamp(13px, 2.8vw, 34px);
  color: #382831;
  background: linear-gradient(145deg, var(--liner-sheen), transparent 66%), var(--liner-paper);
  border: 1px solid #866b66;
  box-shadow: 0 3px #ac9080, 0 6px #553d46, 0 12px 26px #0d0a1370;
}
.listening-heading { display: flex; justify-content: space-between; align-items: center; gap: 14px; padding-bottom: 13px; border-bottom: 1px solid #9b796d; }
.listening-heading h3 { font-size: clamp(1.18rem, 2.1vw, 1.85rem); line-height: 1.38; margin: 0; }
.listening-heading p { font-size: .88rem; line-height: 1.6; margin: 6px 0 0; color: #654957; }
.listening-heading > a { min-height: 44px; display: inline-flex; align-items: center; padding: 6px 12px; background: #492c42; color: #fff4e8; font-size: .87rem; flex: none; }
.listening-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: clamp(22px, 4vw, 60px);
  background: linear-gradient(90deg, transparent 49.6%, #73514138 50%, #fff7e962 50.5%, transparent 51%);
}
.listening-grid article { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 12px; min-width: 0; padding: 13px 0 8px; border-bottom: 1px solid #89675b71; }
.listening-number { width: 43px; height: 30px; font: 750 1.12rem/30px var(--mono); text-align: center; background: var(--song-color); color: #302333; }
.listening-caption { font-size: .77rem; color: #694856; margin: 0 0 2px; }
.listening-grid h4 { font-size: clamp(1rem, 1.45vw, 1.26rem); line-height: 1.4; margin: 0 0 5px; overflow-wrap: anywhere; }
.listening-focus { font-size: .85rem; font-weight: 720; margin: 0 0 4px; }
.listening-description { font-size: .88rem; line-height: 1.55; color: #513b43; margin: 0; }
.listening-grid a, .listening-footer a { display: inline-flex; align-items: center; min-height: 40px; font-size: .84rem; text-decoration: underline; text-underline-offset: 4px; color: #702f54; }
.listening-footer { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0 14px; margin-top: 4px; }
@media (max-width: 700px) {
  .listening-heading { display: grid; justify-items: start; gap: 8px; }
  .listening-grid { grid-template-columns: minmax(0, 1fr); background: none; }
  .listening-grid article { gap: 9px; }
  .listening-number { width: 34px; }
}
</style>
