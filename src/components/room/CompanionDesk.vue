<script setup>
import { computed } from 'vue';
import { cast } from '../../data/playroom.js';
import { useCompanion } from '../../composables/useCompanion.js';
import CompanionControls from '../CompanionControls.vue';
const {state}=useCompanion();
const person=computed(()=>cast.find(c=>c.id===state.value.member));
const asset=path=>`${import.meta.env.BASE_URL}${path}`;
</script>
<template><section class="room-panel" aria-labelledby="companion-title"><div class="play-heading"><div><p class="play-eyebrow">SOMEONE TO REMEMBER / 有人记得今天</p><h2 id="companion-title">那些小事，她都认真收好了。</h2><p class="room-intro">打个招呼，送一件纪念物。完成小屋活动后，伙伴会回应，也会留下一页新的记忆。</p></div><span class="play-number" aria-hidden="true">09</span></div><div class="companion-desk"><div class="companion-portrait" :style="{'--buddy-color':person.color}"><span aria-hidden="true">ひとりじゃない。</span><img :src="asset(person.image)" :alt="person.name" width="260" height="300"><strong>{{person.name}}</strong><p>从一件小事，到下一件小事。<br>今天也有人，和你待在一起。</p></div><CompanionControls/></div></section></template>
<style scoped>.companion-desk{display:grid;grid-template-columns:.9fr 1.1fr;gap:34px;align-items:start}.companion-portrait{background:linear-gradient(155deg,#fff4e8,var(--buddy-color));border:1px solid #cdb6ba;padding:30px;text-align:center;position:sticky;top:110px}.companion-portrait>span{font:14px Georgia,serif;letter-spacing:3px;color:#795a6e;display:block}.companion-portrait img{display:block;object-fit:contain;margin:25px auto;width:100%;max-width:260px;height:300px}.companion-portrait>strong{font-size:24px}.companion-portrait p{font-size:12px;color:#795a6e}@media(max-width:760px){.companion-desk{grid-template-columns:1fr;gap:20px}.companion-portrait{position:static;padding:22px}.companion-portrait img{height:180px;margin:15px auto}}</style>
