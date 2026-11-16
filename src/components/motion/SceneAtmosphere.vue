<script setup>
defineProps({ kind: { type: String, required: true } });
</script>
<template>
  <div :class="['scene-atmosphere',`atmosphere-${kind}`]" aria-hidden="true">
    <template v-if="kind === 'theater'">
      <svg class="notebook-drawing" viewBox="0 0 320 230" fill="none"><path d="M31 94c20-28 51-35 77-20s36 48 22 75-45 38-70 21-27-40-8-58m101-47 21-28 8 37 33 5-27 23 8 34-32-17-25 21 3-35-29-21 40-1m59 112c29-21 53-12 57 3s-16 18-19 9 20-21 39-12"/><path d="m27 192 80 4m-59 8 45 3m162-169 6 11m13-23 3 10"/></svg>
      <span class="paper-scrap scrap-a">small steps<br>still count ✦</span><span class="paper-scrap scrap-b">♪</span>
    </template>
    <template v-else-if="kind === 'gallery'"><i class="window-light"></i><i class="window-frame"></i></template>
    <template v-else-if="kind === 'room'"><span class="room-background-type">AFTER<br>SCHOOL.</span><svg class="room-pencil" viewBox="0 0 360 220" fill="none"><path d="m35 95 74-32 65 31-73 34-66-33v57l66 34 73-34V94m-73 34v58m96-114 44-25 58 33-43 26-59-34v66l59 34 43-26V80m-43 26v66M30 205c60-13 104 16 159 0s97-12 146 0"/></svg></template>
  </div>
</template>
