<script setup>
import {ref,onMounted,onBeforeUnmount} from 'vue';
import {useRoute} from 'vue-router';
import {readTour,updateTour} from '../../room/tour.js';
import {readWorks} from '../../room/workshelf.js';
const route=useRoute(),tour=ref(readTour()),hasWork=ref(readWorks().length>0);
function sync(){tour.value=readTour();hasWork.value=readWorks().length>0;}
onMounted(()=>{window.addEventListener('hitori:tour',sync);window.addEventListener('hitori:works-changed',sync);});onBeforeUnmount(()=>{window.removeEventListener('hitori:tour',sync);window.removeEventListener('hitori:works-changed',sync);});
</script>
<template><aside v-if="tour.step&&!tour.done" class="first-work-guide" aria-label="第一件作品引导"><div><small>第一件作品 · {{tour.step}} / 3</small><h2>{{tour.step===1?'先给合影留一句话':tour.step===2?'把这一版收进作品架':'你已经有自己的小小展览了'}}</h2><p>{{tour.step===1?'在拍贴机挑背景、摆人物，再填写相片文案。':tour.step===2?'点击页面上方的“存入作品架”，为这次创作保留独立版本。':'作品架里的“继续编辑”可以载入旧版本；当前草稿会先另存，导出备份还能带去另一台设备。'}}</p></div><div class="first-guide-actions"><RouterLink v-if="route.path!=='/room/photobooth'&&tour.step<3" to="/room/photobooth">去拍贴机 →</RouterLink><button v-if="tour.step===1" type="button" @click="updateTour({step:2,done:false})">文案写好了，下一步</button><RouterLink v-if="tour.step===2&&hasWork" to="/room/works" @click="updateTour({step:3,done:false})">去作品架看看 →</RouterLink><button v-if="tour.step===3" type="button" @click="updateTour({step:0,done:true})">完成引导 ✓</button><button type="button" @click="updateTour({step:0,done:true})">跳过引导</button></div></aside></template>
