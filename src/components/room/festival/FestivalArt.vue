<script setup>
import { paperFont } from '../../../room/festival/art.js';
defineProps({ picture: { type: Object, required: true }, label: String, fill: Boolean });
</script>

<template>
  <svg class="fest-art" xmlns="http://www.w3.org/2000/svg" :viewBox="`0 0 ${picture.width} ${picture.height}`"
    :preserveAspectRatio="fill ? 'xMidYMid slice' : undefined" :font-family="paperFont" :role="label ? 'img' : undefined" :aria-label="label"
    :aria-hidden="label ? undefined : 'true'" v-html="picture.content"></svg>
</template>
