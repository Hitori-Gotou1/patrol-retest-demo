<script setup>
defineProps({ view:{ type:String,required:true } });
const swatches = {
  pink:{ name:'粉', color:'#e5a0ba', member:'一里', number:2 },
  yellow:{ name:'黄', color:'#e5c67c', member:'虹夏', number:4 },
  blue:{ name:'蓝', color:'#99b9d4', member:'凉', number:1 },
  red:{ name:'红', color:'#d9918b', member:'喜多', number:3 }
};
const poster = ['pink','yellow','blue','red'];
const ticket = ['blue','red','pink','yellow'];
</script>

<template>
  <div class="escape-documents" :class="{ 'is-compared':view==='compare' }">
    <article v-if="view!=='ticket'" class="clue-poster">
      <div class="tape" aria-hidden="true"></div>
      <header><p>STARRY · 彩排海报背面</p><h3>灯光依次走过四种颜色</h3></header>
      <ol aria-label="海报上的颜色顺序">
        <li v-for="color in poster" :key="color">
          <span class="ink-swatch" :style="{ background:swatches[color].color }">{{ swatches[color].name }}</span>
          {{ swatches[color].member }}
        </li>
      </ol>
      <p>这像是储物箱密码的读取顺序。</p>
    </article>
    <article v-if="view!=='poster'" class="clue-ticket">
      <header><p>STARRY · 排练票根背面</p><h3>灯色与号码</h3></header>
      <dl aria-label="票根上的颜色与号码">
        <div v-for="color in ticket" :key="color" :style="{ background:swatches[color].color }">
          <dt>{{ swatches[color].name }}</dt> <dd>{{ swatches[color].number }}</dd>
        </div>
      </dl>
      <p>可以按海报里的顺序读票根。</p>
    </article>
  </div>
</template>

<style scoped>
.escape-documents { display:grid; gap:14px; min-width:0; }
.clue-poster,.clue-ticket { position:relative; min-width:0; color:#4c3949; padding:17px; }
.clue-poster { background:#f8e2c8; border:1px solid #b98d90; box-shadow:3px 4px #b896a3; }
.tape { position:absolute; width:46px; height:17px; transform:rotate(-14deg); left:3px; top:-6px; background:#c9ad91b0; }
.clue-poster header,.clue-ticket header { border-bottom:1px solid #927880; padding-bottom:8px; }
.clue-poster h3,.clue-ticket h3 { margin:0; color:inherit; }
.clue-poster p,.clue-ticket p { font-size:12px; margin:7px 0 0; }
.clue-poster ol,.clue-ticket dl { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:5px; padding:0; margin:13px 0; }
.clue-poster li { display:grid; justify-items:center; min-width:0; gap:4px; font-weight:700; font-size:12px; text-align:center; }
.ink-swatch { display:grid; width:min(100%,44px); height:35px; place-items:center; border:1px solid #946d7e; border-radius:50% 48% 46% 52%; }
.clue-ticket { background:#e6e7d0; border:1px solid #9a9983; border-inline:4px dotted #94868b; }
.clue-ticket dl>div { display:flex; justify-content:center; align-items:center; gap:3px; min-height:41px; border:1px solid #996f7c; }
.clue-ticket dd { font:700 20px var(--mono,monospace); margin:0; }
.clue-ticket dt { font-size:13px; }
@media(min-width:1050px) {
  .is-compared { grid-template-columns:1fr 1fr; align-items:center; gap:10px; }
  .is-compared :is(.clue-poster,.clue-ticket) { padding:12px; }
}
@media(max-width:500px) {
  .clue-poster,.clue-ticket { padding:12px 10px; }
}
</style>
