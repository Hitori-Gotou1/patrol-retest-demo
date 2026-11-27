<script setup>
import { computed } from 'vue';
import { comicDialogue } from '../../room/comicDialogue.js';
const props = defineProps({
  panel: { type: Object, required: true },
  captionHeight: Number
});
const speech = computed(() => comicDialogue(props.panel, props.captionHeight));
</script>

<template>
  <g v-if="panel.dialogue" class="comic-dialogue" pointer-events="none">
    <rect :x="speech.x" :y="speech.y" :width="speech.width" :height="speech.height" :rx="speech.tail ? 17 : 5"
      fill="#fffaf0" stroke="#86667a" stroke-width="1.6"/>
    <path v-if="speech.tail" class="comic-tail" :data-speaker="panel.speaker"
      :data-tip-x="speech.tail.x" :data-tip-y="speech.tail.y" :d="speech.tail.path"
      fill="#fffaf0" stroke="#86667a" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    <text :x="speech.x + 17" :y="speech.y + 25" fill="#423141" font-family="sans-serif" font-size="20">
      <tspan v-for="(line, index) in speech.lines" :key="index" :x="speech.x + 17" :dy="index ? 23 : 0">{{ line }}</tspan>
    </text>
  </g>
</template>
