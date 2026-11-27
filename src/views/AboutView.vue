<script setup>
import '../styles/review-folio.css';
import { onMounted } from 'vue';
import { assetUrl } from '../data/site.js';
import { cast } from '../data/playroom.js';
import { galleryImages } from '../data/gallery.js';
import { withAttribution } from '../data/galleryAttributions.js';
import demoTracks from '../data/music.json';

const opening = withAttribution(galleryImages.find(image => image.id==='quiet-guitar'));
const poster = withAttribution(galleryImages.find(image => image.id==='pink-frequency'));
const demo = demoTracks[0];
const sourceLink = id => ({ path:'/room/sources',query:{source:id} });
onMounted(() => { document.title = '关于小屋 · HITORI ROOM'; });
</script>

<template>
  <main id="main" class="about-page about-booklet-page" tabindex="-1">
    <div class="about-booklet">
      <header class="booklet-title">
        <p class="scene-kicker">写在唱片内页</p>
        <h1>因为喜欢，所以有了<span>这里。</span></h1>
      </header>
      <div class="liner-spread">
        <section class="liner-cover">
          <figure>
            <img :src="assetUrl(opening.src)" :alt="opening.alt" class="liner-opening">
            <figcaption><strong>{{ opening.title }}</strong><span>{{ opening.credit }}<br>{{ opening.creator }}</span>
              <RouterLink :to="sourceLink(opening.id)">查看开场插画的来源 ↗</RouterLink>
            </figcaption>
          </figure>
          <blockquote class="liner-dedication">
            一个收藏勇气的小小空间。<br>献给笨拙地靠近世界的一里，<br>也献给每一个正在练习的我们。
          </blockquote>
          <div class="liner-letter">
            <h2>这间小屋</h2>
            <p>从粉色的开场、四位成员的聚光灯，到纸箱里的脑内剧场、贴满心动的收藏墙与深夜放映室。每一幕，都想留住一种不同的心情。</p>
            <p>这里的角色印象和小剧场是原创想象。你可以点开、听听，也可以安静地逛一会儿。</p>
          </div>
        </section>
        <section class="liner-materials" aria-labelledby="liner-materials">
          <h2 id="liner-materials">画面与声音</h2>
          <article class="liner-cast">
            <div class="liner-portraits">
              <figure v-for="member in cast" :key="member.id" :style="{ '--portrait-paper':member.color }">
                <img :src="assetUrl(member.image)" alt="" width="130" height="154"><figcaption>{{ member.name }}</figcaption>
              </figure>
            </div>
            <div class="liner-credits"><h3>四位成员立绘</h3><p>站主提供。收藏墙上的图片逐张保留原有来源记录。</p><RouterLink to="/room/sources">翻阅收藏来源档案 ↗</RouterLink></div>
          </article>
          <article class="liner-item">
            <img :src="assetUrl(poster.src)" :alt="poster.alt" width="110" height="90">
            <div class="liner-credits"><h3>{{ poster.title }}</h3><p>{{ poster.method }} · {{ poster.creator }}</p>
              <RouterLink :to="sourceLink(poster.id)">查看图形海报的来源 ↗</RouterLink>
            </div>
          </article>
          <article class="liner-item liner-demo">
            <div class="liner-sleeve" aria-hidden="true"><i></i><img :src="assetUrl(demo.cover)" alt=""></div>
            <div class="liner-credits"><h3>{{ demo.title }}</h3><p>本站程序合成的原创演示音频。</p>
              <RouterLink :to="{ path:'/',query:{ listen:'demo' },hash:'#video' }">到练习唱片试听 ↗</RouterLink>
            </div>
          </article>
        </section>
      </div>
      <section class="liner-thanks" aria-labelledby="liner-thanks">
        <h2 id="liner-thanks">灵感与感谢</h2>
        <div>
          <article><h3 lang="ja">ぼっち・ざ・ろっく！</h3><p>感谢《孤独摇滚！》带来的音乐、伙伴与向前迈步的勇气。</p><a href="https://bocchi.rocks/" target="_blank" rel="noopener noreferrer">《孤独摇滚！》官方网站 ↗</a></article>
          <article><h3>设计参考</h3><p>设计灵感参考 sudoriaa 的开源展示项目。我们重新实现了交互，并为手机和键盘操作做了适配。</p><a href="https://github.com/sudoriaa/BOCCHI-THE-ROCK" target="_blank" rel="noopener noreferrer">设计参考项目 ↗</a></article>
          <article><h3>一里小屋</h3><p>小屋的页面、互动和练习音频也在这里慢慢更新。</p><a href="https://github.com/Hitori-Gotou1/patrol-retest-demo" target="_blank" rel="noopener noreferrer">一里小屋 · GitHub ↗</a></article>
        </div>
      </section>
      <RouterLink :to="{path:'/',hash:'#home'}" class="liner-home">回到开场 ↗</RouterLink>
    </div>
  </main>
</template>

<style scoped>
.about-booklet-page { padding:115px 16px 39px; background:#221d2a; color:#483548; }
.about-booklet { font-size:calc(15px * var(--reader-scale,1)); line-height:var(--reader-line,1.8); max-width:1120px; margin:auto; border:1px solid #a68094; padding:clamp(12px,3.1vw,37px); background:#f6e8d4; }
.booklet-title { border-bottom:1px solid #a98594; padding-bottom:8px; }
.about-booklet-page .booklet-title .scene-kicker { color:#774d65; margin:0; }
.about-booklet-page .booklet-title h1 { margin:4px 0 0; font-size:calc(clamp(25px,4.7vw,54px) * var(--reader-scale,1)); line-height:1.25; letter-spacing:-.035em; }
.liner-spread { display:grid; grid-template-columns:minmax(0,1.05fr) minmax(0,1fr); gap:clamp(14px,3vw,33px); padding-top:14px; }
.liner-spread>section { min-width:0; }
.liner-materials { border-left:1px solid #b695a0; padding-left:clamp(12px,2.4vw,27px); }
.liner-cover figure { margin:0; min-width:0; }
.liner-opening { display:block; width:100%; aspect-ratio:1.45; max-height:350px; object-fit:cover; object-position:72% 43%; border:4px solid #fff5e6; }
.liner-cover figcaption { display:grid; gap:2px; background:#eddac7; border:1px solid #c9aca6; padding:7px 9px; color:#5f4156; }
.liner-cover figcaption span { font-size:.8em; }
.liner-dedication { margin:12px 0; padding:3px 0 3px 12px; border-left:3px solid #ae7d93; color:#563a4f; font-weight:700; }
.liner-letter p { margin:3px 0 8px; }
.liner-spread :is(h2,h3),.liner-thanks :is(h2,h3) { margin:0; line-height:1.35; color:#543d51; }
.liner-spread h2,.liner-thanks h2 { font-size:1.22em; }
.liner-spread h3,.liner-thanks h3 { font-size:1em; }
.about-booklet p { overflow-wrap:anywhere; }
.about-booklet a { display:inline-flex; align-items:center; width:fit-content; min-height:44px; color:#683a5b; text-underline-offset:4px; font-size:.87em; }
.about-booklet a:focus-visible { outline:2px solid #813a65; outline-offset:3px; }
.liner-portraits { list-style:none; display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:5px; margin:5px 0 7px; }
.liner-portraits figure { min-width:0; margin:0; text-align:center; padding:3px; border:1px solid #c09da8; background:color-mix(in srgb,var(--portrait-paper) 23%,#fff2de); }
.liner-portraits img { display:block; width:100%; height:clamp(67px,8vw,103px); object-fit:contain; }
.liner-portraits figcaption { font-size:.65em; line-height:1.32; overflow-wrap:anywhere; margin-top:4px; }
.liner-credits { min-width:0; overflow-wrap:anywhere; }
.liner-credits p { margin:3px 0 0; color:#63495a; font-size:.86em; }
.liner-item { display:grid; grid-template-columns:minmax(60px,.42fr) minmax(0,1fr); align-items:center; gap:9px 12px; padding-top:8px; margin-top:8px; border-top:1px solid #c7aeb3; }
.liner-item>img { display:block; width:100%; height:clamp(78px,9vw,106px); object-fit:contain; background:#eeded4; }
.liner-sleeve { display:grid; position:relative; padding-right:17%; max-width:130px; }
.liner-sleeve i { position:absolute; width:82%; right:2%; aspect-ratio:1; top:7%; border-radius:50%; background:repeating-radial-gradient(#554151 0 2px,#493746 3px 5px); }
.liner-sleeve img { position:relative; display:block; width:100%; aspect-ratio:1; object-fit:contain; border:1px solid #b0939f; background:#e1c5ce; }
.liner-thanks { margin-top:20px; padding:12px 0 4px; border-top:1px solid #b28f9f; }
.liner-thanks>div { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px 14px; margin-top:9px; }
.liner-thanks article { min-width:0; padding:7px; background:#ead6c7; overflow-wrap:anywhere; }
.liner-thanks p { margin:5px 0 0; font-size:.88em; }
.liner-home { margin-top:7px; }
@media(max-width:720px) {
  .about-booklet-page { padding:112px 10px 20px; }
  .liner-spread,.liner-thanks>div { grid-template-columns:minmax(0,1fr); }
  .liner-spread { gap:12px; }
  .liner-materials { border-left:0; border-top:1px solid #b898a5; padding:9px 0 0; }
  .liner-cover figcaption { padding:6px; }
  .liner-item { grid-template-columns:minmax(64px,.35fr) minmax(0,1fr); }
}
</style>
