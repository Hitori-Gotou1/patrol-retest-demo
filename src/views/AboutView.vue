<script setup>
import { onMounted } from 'vue';
onMounted(() => { document.title = '关于小屋 · HITORI ROOM'; });
</script>
<template>
  <main id="main" class="about-page" tabindex="-1">
    <div class="about-page-inner">
      <span class="scene-kicker">LINER NOTES / 写在唱片内页</span>
      <h1>因为喜欢，<br>所以有了<span>这里。</span></h1>
      <p class="about-lead">一个收藏勇气的小小空间。<br>献给笨拙地靠近世界的一里，<br>也献给每一个正在练习的我们。</p>
      <div class="about-notes"><section><h2>这间小屋</h2><p>从粉色的开场、四位成员的聚光灯，到纸箱里的脑内剧场、贴满心动的收藏墙与深夜放映室。每一幕，都想留住一种不同的心情。</p><p>这里的角色印象和小剧场是原创想象；练习唱片是本站合成的原创 Demo。你可以点开、听听，也可以安静地逛一会儿。</p></section><section><h2>灵感与感谢</h2><p>感谢《孤独摇滚！》带来的音乐、伙伴与向前迈步的勇气。设计灵感参考 sudoriaa 的开源展示项目，我们重新实现了交互，并为手机和键盘操作做了适配。</p><a href="https://bocchi.rocks/" target="_blank" rel="noopener noreferrer">《孤独摇滚！》官方网站 ↗</a><a href="https://github.com/sudoriaa/BOCCHI-THE-ROCK" target="_blank" rel="noopener noreferrer">设计参考项目 ↗</a><a href="https://github.com/Hitori-Gotou1/patrol-retest-demo" target="_blank" rel="noopener noreferrer">一里小屋 · GitHub ↗</a></section></div>
      <div class="about-colophon"><span>DESIGN & CODE / HITORI ROOM</span><span>插画封面 · AI 同人创作<br>四位成员立绘 / 收藏图片 · 站主提供<br>图形海报 / 练习音频 · 本站原创</span></div>
      <RouterLink :to="{path:'/',hash:'#home'}" class="button button-pink">回到开场 <span aria-hidden="true">↗</span></RouterLink>
    </div>
    <span class="about-background-type" aria-hidden="true">ひとり<br>じゃない。</span>
  </main>
</template>
