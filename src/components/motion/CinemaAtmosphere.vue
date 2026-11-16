<script setup>
defineProps({ mood: String });
</script>
<template>
 <div class="cinema-atmosphere" aria-hidden="true">
  <div class="cinema-mood mood-warm" :class="{'is-selected':mood==='warm'}"><i class="practice-lamp"></i><i class="projection-beam warm-beam"></i><div class="cinema-dust"><i v-for="n in 7" :key="n" :style="{'--n':n}"></i></div><span class="room-window"></span></div>
  <div class="cinema-mood mood-rain" :class="{'is-selected':mood==='rain'}"><i class="rain-neon"></i><div class="rain-window"><i v-for="n in 14" :key="n" :style="{'--n':n}"></i><span>STARRY</span></div><i class="rain-reflection"></i></div>
  <div class="cinema-mood mood-stage" :class="{'is-selected':mood==='stage'}"><i v-for="(color,n) in ['#ec9cc4','#e9cb76','#83b8de','#e48687']" :key="color" class="stage-spotlight" :style="{'--spot-color':color,'--n':n}"></i><i class="stage-haze"></i><span class="stage-standby">STAND BY<br><small>FOUR COLORS / ONE STAGE</small></span></div>
 </div>
</template>
