<script setup>
defineProps({
  place: { type: String, required: true },
  ink: { type: String, required: true },
  pressed: Boolean
});
</script>

<template>
  <g :stroke="ink" :fill="pressed ? ink : 'none'" :fill-opacity="pressed ? '.14' : '0'"
     stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <g v-if="place === 'station'" transform="rotate(-13)">
      <path d="M-32-21H32v13a8 8 0 0 0 0 16v13h-64V8a8 8 0 0 0 0-16z"/>
      <path d="M13-14v28" stroke-dasharray="2 5"/>
      <path d="M-18 3h19m-15-7h11m-12 14h12" fill="none"/>
    </g>
    <g v-else-if="place === 'shop'" transform="rotate(13)">
      <path d="M-30-17c4-15 54-16 59-2 7 18-16 45-27 48-11 3-38-25-32-46Z"/>
      <path d="M-18-13q18-8 35-3M-5 13l5 6" fill="none"/>
    </g>
    <g v-else-if="place === 'vending'" transform="rotate(-9)">
      <path d="M-21-19v36q0 11 21 11t21-11v-36z"/>
      <ellipse cy="-19" rx="21" ry="8"/>
      <path d="M-4-19c0-5 9-5 10 0s-10 4-10 0Zm-13 17 13 5 11-6 11 3M-17 13q17 9 34 0" fill="none"/>
    </g>
    <g v-else-if="place === 'park'">
      <path d="M-23 19Q-33-15 0-22q11-3 31-5C27 9 9 33-23 19Z"/>
      <path d="M-28 27 16-13M-4 6l-2-14m2 14 16-1M6-3l1-12" fill="none"/>
    </g>
    <g v-else-if="place === 'bridge'" fill="none">
      <path d="M-32 12h64m-55 1v14M0 13v14m23-14v14M-32 27h64M-28-4h24c16 0 15-20 5-20-5 0-7 3-7 5m-26 24h54c13 0 13-15 4-15"/>
    </g>
    <g v-else-if="place === 'starry'">
      <path d="M-30 28v-51h60v51"/>
      <path d="M-35-23h70M-23-15h46m-42 46h38m-19-40 4 9 10 1-8 7 2 10-8-5-8 5 2-10-8-7 10-1Z"/>
    </g>
  </g>
</template>
