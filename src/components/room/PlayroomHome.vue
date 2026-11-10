<script setup>
import {computed,ref} from 'vue';
import { playroomCards } from '../../data/playroom.js';
import { adventureCards } from '../../data/adventures.js';
import { playgroundCards } from '../../data/playground.js';
const category=ref('new');
const cards=computed(()=>category.value==='new'?playgroundCards:category.value==='adventure'?adventureCards:category.value==='creative'?playroomCards:[...playgroundCards,...adventureCards,...playroomCards]);
</script>
<template>
  <section aria-labelledby="playroom-title">
    <div class="play-hub-title"><p class="room-kicker">STAY A LITTLE LONGER / 再玩一会儿</p><h2 id="playroom-title">放学以后，<br>小屋还亮着灯。</h2><p>拍一张合影，布置自己的房间，或者出门走一小段。<br>今天的小小作品，都可以留在这里。</p></div>
    <p class="room-kicker">ONE MORE PLAY / 十个新的游乐与创作角落</p>
    <div class="pg-hub-tabs" aria-label="活动分类"><button v-for="(label,id) in {new:'游乐与创作 · 10',adventure:'小冒险 · 6',creative:'创作角落 · 6',all:'全部 · 22'}" :key="id" :aria-pressed="category===id" @click="category=id">{{label}}</button></div>
    <div class="play-cards"><RouterLink v-for="item in cards" :key="item.id" :to="`/room/${item.id}`" class="play-card" :style="{'--card-color':item.color}"><span class="card-index">{{item.number}}</span><span class="play-card-icon" aria-hidden="true">{{item.icon}}</span><small>{{item.en}}</small><h2>{{item.title}}</h2><p>{{item.description}}</p><span class="play-card-action">{{item.action}}<span aria-hidden="true">↗</span></span></RouterLink></div>
    <div class="play-announcement"><strong>也可以，给今天留一段练习。</strong><div class="play-secondary-links"><RouterLink to="/room/rhythm">节奏练习 ↗</RouterLink><RouterLink to="/room/studio">十六步编曲 ↗</RouterLink><RouterLink to="/room/stories">分支小剧场 ↗</RouterLink><RouterLink to="/room/practice">练琴计时 ↗</RouterLink><RouterLink to="/room/notes">翻翻站主手记 ↗</RouterLink><RouterLink to="/room/guestbook">留一句话 ↗</RouterLink></div></div>
  </section>
</template>
