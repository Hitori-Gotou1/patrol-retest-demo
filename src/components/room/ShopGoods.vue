<script setup>
defineProps({ kind:{ type:String, required:true } });
</script>

<template>
  <svg viewBox="0 0 108 70" aria-hidden="true" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <g v-if="kind==='guitar' || kind==='bass'">
      <path d="M10 8h88v54H10z" :fill="kind==='guitar' ? '#d3af87' : '#7a8b9d'" stroke="#483747" stroke-width="2"/>
      <path d="M12 17h84" stroke="#fff3d8" stroke-opacity=".72"/>
      <ellipse cx="54" cy="37" rx="28" ry="16" stroke="#52434b" :stroke-width="kind==='guitar' ? 1.8 : 4.2"/>
      <ellipse cx="54" cy="37" rx="22" ry="12" stroke="#f9e1af" :stroke-width="kind==='guitar' ? 1.1 : 2.6"/>
      <ellipse cx="54" cy="37" rx="16" ry="8" stroke="#5e4b57" :stroke-width="kind==='guitar' ? 1.4 : 3.5"/>
      <path d="M65 52q21 5 29-12" stroke="#53434b" :stroke-width="kind==='guitar' ? 1.5 : 3"/>
    </g>
    <g v-else-if="kind==='sticks'" stroke="#805244">
      <path d="M15 52 86 15l8-6 5 7-10 4-68 39Z" fill="#e2ba81" stroke-width="2"/>
      <path d="m14 42 71-22 9-4 4 8-10 2-72 23Z" fill="#efce96" stroke-width="2"/>
      <path d="m22 43 60-20m-56 30 54-28" stroke="#f9e5b5" stroke-width="1.4"/>
    </g>
    <g v-else-if="kind==='pick'">
      <rect x="18" y="8" width="72" height="54" rx="6" fill="#e7dbcf" fill-opacity=".55" stroke="#876672" stroke-width="2"/>
      <path d="M20 21h68m-64 36 12-13M52 18l15-8" stroke="#fffbef" stroke-width="3"/>
      <path d="M32 34q3-13 28-10t10 18q-8 15-17 15T32 34Z" fill="#cb7795" fill-opacity=".87" stroke="#805368" stroke-width="2"/>
      <path d="M51 33q10-7 23-5t8 12q-8 12-13 10T51 33Z" fill="#e0ad65" fill-opacity=".78" stroke="#a37459" stroke-width="2"/>
    </g>
    <g v-else>
      <path d="M28 8h52l4 53H24Z" :fill="{ clean:'#b6caba',drive:'#dc95a4',delay:'#abc3da' }[kind]" stroke="#715365" stroke-width="2.5"/>
      <path d="M27 31h54M22 36h5m54 0h6" stroke="#795566" stroke-width="3"/>
      <circle cx="43" cy="21" r="5" fill="#4e3e52"/><circle cx="63" cy="21" r="5" fill="#4e3e52"/>
      <circle cx="54" cy="48" r="7" fill="#fff0d6" stroke="#684e60" stroke-width="3"/>
    </g>
  </svg>
</template>
