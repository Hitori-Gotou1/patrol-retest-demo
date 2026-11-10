<script setup>
import { cast } from '../data/playroom.js';
import { activityKinds } from '../room/activityLog.js';
import { useCompanion } from '../composables/useCompanion.js';
const {state,saved,choose,greet,gift,rest}=useCompanion();
const props=defineProps({compact:Boolean});
const asset=path=>`${import.meta.env.BASE_URL}${path}`;
</script>
<template>
  <div class="buddy-controls">
    <div class="buddy-members" role="group" aria-label="选择小屋伙伴"><button v-for="person in cast" :key="person.id" type="button" :aria-pressed="state.member===person.id" @click="choose(person.id)"><img :src="asset(person.image)" alt="" width="44" height="48"><span>{{person.name}}</span></button></div>
    <p class="buddy-reply" role="status">{{state.reply}}</p>
    <div class="buddy-meters"><label>社交电量 <strong>{{state.energy}}</strong><meter min="0" max="100" :value="state.energy" aria-label="伙伴社交电量"></meter></label><label>勇气手帐 <strong>{{state.courage}}</strong><meter min="0" max="100" :value="state.courage" aria-label="伙伴勇气"></meter></label></div>
    <div class="buddy-actions"><button type="button" @click="greet">打个招呼</button><button type="button" @click="rest">一起休息</button><RouterLink to="/room/practice" @click="state.reply='那就一起，给今天留下一段练习吧。'">邀请练习 ↗</RouterLink></div>
    <h3>纪念物，也可以送给她</h3><div class="buddy-gifts"><button v-for="[id,label,icon] in [['tea','温热茶饮','♨'],['pick','新拨片','♬'],['sticker','小贴纸','✦']]" :key="id" type="button" :disabled="state.gifts[id]===0" @click="gift(id)"><span aria-hidden="true">{{icon}}</span>{{label}} × {{state.gifts[id]}}</button></div>
    <template v-if="!props.compact"><h3>她替你记得的小事</h3><ol v-if="state.memories.length" class="buddy-memories"><li v-for="memory in state.memories" :key="memory.id"><span>{{activityKinds[memory.kind]}}</span><strong>{{memory.detail}}</strong></li></ol><p v-else class="buddy-note">完成一轮挑战、导出作品，或保存喜欢的音色后，再来看看。她会留住最近八件小事。</p><label class="buddy-visibility"><input v-model="state.enabled" type="checkbox">在页面角落显示伙伴</label><label class="buddy-visibility"><input v-model="state.compact" type="checkbox">收成小按钮</label></template>
    <RouterLink v-if="props.compact" to="/room/companion" class="buddy-desk-link">翻开完整伙伴手帐 ↗</RouterLink>
    <p class="buddy-note">{{saved?'记忆和纪念物保存在当前设备。':'浏览器暂时无法保存，当前仍可互动。'}} 回应为本站创作的角色小剧场。</p>
  </div>
</template>
<style scoped>
.buddy-controls{color:#594552;font-size:13px;line-height:1.7;min-width:0}.buddy-controls button,.buddy-controls a{font:inherit;color:#624a5c}.buddy-controls button{min-height:44px;border:1px solid #c5aeb6;background:#fffaf0;padding:8px 10px;cursor:pointer}.buddy-controls button:disabled{opacity:.5;cursor:default}.buddy-members{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.buddy-members button{display:flex;flex-direction:column;align-items:center;padding:6px 2px;font-size:10px;gap:4px}.buddy-members button[aria-pressed=true]{background:#eed7e1;border-color:#9c6885}.buddy-members img{width:44px;height:48px;object-fit:contain}.buddy-reply{margin:18px 0;padding:16px;background:#eedfe5;border-left:3px solid #b7839d;min-height:58px;overflow-wrap:anywhere}.buddy-meters{display:grid;grid-template-columns:1fr 1fr;gap:15px}.buddy-meters label{font-size:11px}.buddy-meters strong{float:right}.buddy-meters meter{display:block;width:100%;height:12px;accent-color:#b16c8e}.buddy-actions,.buddy-gifts{display:flex;flex-wrap:wrap;gap:7px;margin:18px 0}.buddy-actions>a{padding:9px 5px;display:inline-flex;align-items:center;min-height:44px;text-underline-offset:4px}.buddy-controls h3{font-size:13px;margin:18px 0 10px}.buddy-gifts button{font-size:11px;display:flex;gap:7px;align-items:center}.buddy-gifts button>span{font-size:20px;color:#ac7292}.buddy-memories{list-style:none;padding:0;margin:0}.buddy-memories li{padding:12px 0;border-top:1px solid #e3d2cd;display:grid;gap:3px}.buddy-memories span{font-size:10px;color:#977181}.buddy-memories strong{font-size:13px;font-weight:500;overflow-wrap:anywhere}.buddy-visibility{display:flex;align-items:center;gap:8px;min-height:44px;font-size:12px}.buddy-visibility input{width:18px;height:18px;accent-color:#a97592}.buddy-note{font-size:10px;line-height:1.8;color:#937882}.buddy-desk-link{font-size:11px;text-underline-offset:4px;display:inline-flex;min-height:44px;align-items:center}.buddy-controls :focus-visible{outline:2px solid #93657e;outline-offset:3px}
</style>
