<script setup>
defineProps({ kind: { type: String, required: true } });
</script>

<template>
  <svg viewBox="0 0 24 24" class="calendar-symbol" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">
    <g v-if="kind === '生日'">
      <path d="M7 21h10m-8 0V10h6v11m-3-11V8m0 0c-4 0-3-4 0-6 0 3 4 6 0 6ZM9 15l6-2m-6 6 6-2"/>
    </g>
    <g v-else-if="kind === '演出'">
      <path d="M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4zM15 7v10" stroke-dasharray="none"/>
      <path d="M7 12h5"/>
    </g>
    <g v-else-if="kind === '发售'">
      <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="M7 12a5 5 0 0 1 5-5m0 10a5 5 0 0 0 5-5"/>
    </g>
    <g v-else>
      <path d="M5 3h10l4 4v14H5Zm10 0v5h4M8 12h8m-8 4h6"/>
    </g>
  </svg>
</template>
