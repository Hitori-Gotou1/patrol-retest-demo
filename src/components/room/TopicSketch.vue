<script setup>
defineProps({ kind: String });
</script>
<template>
 <svg class="topic-sketch" viewBox="0 0 160 118" fill="none" aria-hidden="true">
  <g v-if="kind==='project'" transform="rotate(-12 80 59)"><path class="sketch-paper" d="M19 29h122v19a12 12 0 0 0 0 24v18H19V72a12 12 0 0 0 0-24V29Z"/><path d="M113 31v57" stroke-dasharray="3 4"/><path d="M36 46h54M36 55h35M36 76h46"/><text x="35" y="71">STARRY</text><path d="m123 46 4 8 8 1-6 6 1 8-7-4-7 4 2-8-6-6 8-1Z"/></g>
  <g v-else-if="kind==='calendar'" transform="rotate(8 80 59)"><rect class="sketch-paper" x="38" y="18" width="87" height="91" rx="3"/><path d="M38 42h87M54 12v18M73 12v18M93 12v18M111 12v18M53 57h55M53 73h55M53 89h55M69 49v47M89 49v47"/><circle cx="99" cy="70" r="13" class="sketch-ring"/><path d="m23 77-9 8 9 5m113-53 9-8m-5 21 10-1"/></g>
  <g v-else transform="rotate(-7 80 59)"><path class="sketch-paper" d="m14 29 41-11 51 14 39-13v80l-39 12-51-14-41 10V29Z"/><path d="M55 18v79m51-65v79M27 51l17-7 33 19 52-18M32 88l37-11 23 11 32-14"/><path class="sketch-route" d="m29 72 37-23 32 19 31-27" stroke-dasharray="4 4"/><path class="sketch-pin" d="M102 47c0-15 23-15 23 0 0 8-12 20-12 20s-11-12-11-20Z"/><circle cx="113.5" cy="46" r="4"/></g>
 </svg>
</template>
