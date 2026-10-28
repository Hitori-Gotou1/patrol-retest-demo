<script setup>
import { useId } from 'vue';
import { useInteractionAudio } from '../composables/useInteractionAudio.js';
defineProps({ compact: Boolean });
const { enabled, volume, message, setEnabled, setVolume } = useInteractionAudio('sound-control');
const id = `sfx-volume-${useId()}`;
</script>

<template>
  <div class="interaction-sound" :class="{ compact }" :data-sfx-enabled="enabled" @keydown.stop @pointerdown.stop @pointerup.stop>
    <button class="sound-toggle" type="button" :aria-pressed="enabled" :aria-label="enabled ? '关闭互动音效' : '开启互动音效'" @click="setEnabled(!enabled)">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4Z"/><path v-if="enabled" d="M16 8q6 4 0 8M18 4q11 8 0 16"/><path v-else d="m17 9 5 6m0-6-5 6"/></svg><span>音效 {{ enabled ? '开' : '关' }}</span>
    </button>
    <details class="sound-settings">
      <summary aria-label="互动音效音量设置"><span aria-hidden="true">≋</span></summary>
      <div class="sound-settings-panel"><label :for="id">互动音量 <span>{{ Math.round(volume * 200) }}%</span></label><input :id="id" class="sfx-volume" type="range" min="0" max="0.5" step="0.01" :value="volume" :aria-valuetext="`${Math.round(volume * 200)}%`" @input="setVolume($event.target.value)"><small>只调节互动声，音乐播放器独立控制。</small></div>
    </details>
    <span class="visually-hidden" role="status" aria-live="polite">{{ message }}</span>
  </div>
</template>

<style scoped>
.interaction-sound { display:flex; align-items:center; gap:3px; position:relative; font-size:11px; color:inherit; flex-shrink:0; }
.sound-toggle { display:flex; align-items:center; justify-content:center; gap:6px; min-height:40px; padding:7px 9px; color:inherit; border:1px solid currentColor; background:transparent; white-space:nowrap; font:inherit; cursor:pointer; }
.sound-toggle[aria-pressed='true'] { background:color-mix(in srgb,currentColor 10%,transparent); }
.sound-toggle svg { width:16px; height:16px; fill:none; stroke:currentColor; stroke-width:1.4; stroke-linecap:round; stroke-linejoin:round; }
.sound-settings summary { list-style:none; cursor:pointer; padding:6px; min-width:30px; min-height:40px; display:grid; place-items:center; font-size:19px; }
.sound-settings summary::-webkit-details-marker { display:none; }
.sound-settings-panel { position:absolute; top:calc(100% + 10px); right:0; width:min(230px,calc(100vw - 36px)); z-index:100; padding:16px; color:#321723; background:#fff8ec; border:1px solid #321723; box-shadow:4px 4px 0 #32172325; }
.sound-settings-panel label { display:flex; justify-content:space-between; font-size:12px; }
.sfx-volume { display:block; width:100%; margin:15px 0; accent-color:#ac456e; height:22px; }
.sound-settings-panel small { display:block; font-size:10px; line-height:1.7; opacity:.7; }
.sound-toggle:focus-visible,.sound-settings summary:focus-visible { outline:2px solid currentColor; outline-offset:3px; }
.compact .sound-toggle { border-color:transparent; padding:4px; }
@media(max-width:370px) { .compact { gap:0; font-size:10px; } .compact .sound-toggle { gap:4px; } .compact .sound-settings summary { min-width:24px; padding:4px; } }
</style>
