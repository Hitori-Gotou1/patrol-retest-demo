<script setup>
defineProps({
  color: { type: String, required: true },
  instrument: { type: String, default: 'guitar' },
  movement: { type: Number, default: 0 },
  frozen: Boolean
});
</script>

<template>
  <g stroke-linecap="round" stroke-linejoin="round" stroke-width="3">
    <ellipse cy="148" rx="42" ry="7" fill="#100e1a" opacity=".7" />
    <path d="M-17 51-18 100-24 142-9 143 3 104 7 66M8 60l11 43 1 40 16-1 1-45L29 48" fill="#272039" :stroke="color" />
    <path d="m-23 140-15 8q-3 5 9 5h21l4-10m25 0 11 8h13q8-1 2-7l-13-6" :fill="color" stroke="#2c2034" />
    <path d="M-26-12q22-15 48 1l16 49-18 33-42-2-15-39Z" :fill="color" stroke="#211829" />
    <path d="M-21 15 20 65m-32-42-8 25m43-9-16 6" fill="none" stroke="#2c2034" opacity=".42" />
    <path d="M-19-32q-11-7-15 12l-6 27 15-5 10-26m7 0 5 16 13 8 8-26" :fill="color" stroke="#2c2034" />
    <path d="M-23-44q-1-24 22-31 33-2 35 29l-12 19-12 4-24-7Z" fill="#eed6b6" stroke="#211829" />
    <path d="M-25-43q-7-21 10-32 19-14 43 2 10 8 11 19l-3 16-7-16-9 3-6-13-10 11-11-2-7 19-12-3Z" :fill="color" stroke="#231827" />
    <path d="m8-42 2 0m12-3h2" stroke="#2d2738" />
    <path v-if="instrument==='voice'" d="M24-18 38-25m-1 1 14 118m-8 0h18" fill="none" stroke="#cfb7c6" />
    <g v-if="instrument!=='voice'" :transform="`rotate(${movement * .16} 0 36)`">
      <path d="M-27 26q-16-1-15 17-4 20 15 25 16 8 28-5 15-2 22-18l-6-16-18 7q-10-11-26-10Z" fill="#252335" :stroke="color" stroke-width="2" />
      <path d="M3 43 56 24l4 7L7 53Z" fill="#e2b882" stroke="#2c2034" stroke-width="2" />
      <path d="m55 23 14-8 6 9-14 8Z" :fill="color" stroke="#291d31" stroke-width="2" />
      <path d="M-16 53 65 24m-79 32 80-30" fill="none" stroke="#f3e5cf" stroke-width="1" />
      <path :d="`M-29 4-33 19-18 ${frozen ? 36 : 46 + movement * .16}M23 2l13 18 15 9`" fill="none" :stroke="color" stroke-width="13" />
      <path d="M48 27q7-7 12 0l-8 6m-75 17q3-7 8-4l2 7-5 4" fill="#ebccb4" stroke="#2c2034" stroke-width="2" />
    </g>
    <path v-else :d="`M-24 3-30 28-11 37M22 3l13 17L${39+movement*.12} -19`" fill="none" :stroke="color" stroke-width="13" />
  </g>
</template>
