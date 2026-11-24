<script setup>
import { storageLabels } from '../../../room/festival/drafts.js';
defineProps({ status: { type: String, required: true } });
</script>

<template>
  <p class="fest-storage" :class="{ 'fest-storage-warning': ['unavailable', 'unreadable', 'conflict'].includes(status) }" role="status">
    <span aria-hidden="true"></span>{{ storageLabels[status] }}
  </p>
</template>
