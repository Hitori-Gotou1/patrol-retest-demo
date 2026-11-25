<script setup>
import { nextTick, ref, shallowRef } from 'vue';
import { downloadStage } from '../../../room/exportImage.js';
import FestivalArt from './FestivalArt.vue';

const picture = shallowRef(null);
const target = ref(null);
const busy = ref(false);
const status = ref('');

async function download(create, filename, scale = 2) {
  if (busy.value) return;
  busy.value = true;
  status.value = '正在生成 PNG…';
  try {
    picture.value = create();
    await nextTick();
    await document.fonts?.ready;
    await downloadStage(target.value.querySelector('svg'), filename, { scale });
    status.value = `已生成 ${filename}`;
  } catch (error) {
    status.value = error.message || 'PNG 生成失败，请重试。';
  } finally {
    picture.value = null;
    busy.value = false;
  }
}
</script>

<template>
  <slot :download="download" :busy="busy"></slot>
  <p v-if="status" class="fest-status" role="status">{{ status }}</p>
  <div v-if="picture" ref="target" hidden aria-hidden="true"><FestivalArt :picture="picture" /></div>
</template>
