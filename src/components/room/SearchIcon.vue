<script setup>defineProps({ kind: String });</script>
<template><g stroke="#5a4955" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
  <path v-if="kind==='pick'" d="M-19-16Q0-29 19-16L4 24q-4 8-8 0Z" fill="#d68aa7"/>
  <g v-else-if="kind==='tuner'"><rect x="-24" y="-18" width="48" height="37" rx="4" fill="#79768b"/><rect x="-17" y="-12" width="34" height="21" fill="#bed6bc"/><path d="M-12 1h24M0-8v12"/><circle cy="14" r="2" fill="#edc988"/></g>
  <g v-else-if="kind==='coin'" fill="#e4c274"><ellipse cx="-10" cy="6" rx="13" ry="6"/><ellipse cx="13" cy="-2" rx="13" ry="7"/><path d="M-23 6v7q13 10 26 0V6M0-2v8q13 10 26 0v-8"/><path d="M-14 8h8M10 0h7"/></g>
  <g v-else-if="kind==='drink'"><rect x="-14" y="-26" width="28" height="54" rx="6" fill="#a9c8c9"/><path d="M-12-21h24M-12 22h24"/><path d="m2-12-10 15h10l-4 12 14-18H2Z" fill="#eee1a2" stroke="none"/></g>
  <g v-else-if="kind==='sticks'" fill="#cfaa7c"><path d="m-28-21 5-5 49 48-5 5Z"/><path d="m23-25 5 5-49 48-5-5Z"/></g>
  <g v-else-if="kind==='cable'" fill="none" stroke="#655871" stroke-width="5"><path d="M-30-12c45-40 76 20 25 31-30 8-47-22-16-30 37-10 46 29 14 31"/><path d="M-30-12l-5 12M-7 20l10 10" stroke="#c09b7c" stroke-width="7"/></g>
  <g v-else-if="kind==='ticket'"><path d="M-32-18H32v10q-12 7 0 14v12H-32V6q12-7 0-14Z" fill="#e0acb8"/><path d="M15-15v30" stroke-dasharray="3 4"/><path d="M-20-5H5M-20 5H-3"/></g>
  <g v-else-if="kind==='headphones'" fill="#8f9db7"><path d="M-23 5v-10a23 23 0 0 1 46 0V5" fill="none" stroke-width="7"/><rect x="-29" y="0" width="14" height="27" rx="5"/><rect x="15" y="0" width="14" height="27" rx="5"/></g>
  <g v-else-if="kind==='notebook'"><rect x="-21" y="-28" width="42" height="56" rx="2" fill="#d3b2bf"/><path d="M-10-28v56M-4-15h17M-4-6h17M-4 3h12"/><path d="M-26-19h10m-10 15h10m-10 15h10m-10 14h10"/></g>
  <g v-else-if="kind==='key'"><circle cx="-10" cy="-10" r="14" fill="#d8ba7d"/><circle cx="-10" cy="-10" r="5" fill="#f3e7d4"/><path d="M0 0 26 26m-8-8-8 7m2-13-7 7" fill="none" stroke="#b79561" stroke-width="7"/></g>
  <g v-else-if="kind==='clip'"><path d="M-25-18H-2V8h-23z" fill="#8abbd3" transform="rotate(-9)"/><path d="M0-4h24v25H0z" fill="#e4ca82" transform="rotate(8)"/></g>
  <g v-else-if="kind==='pen'"><path d="m-20 22 9-17L18-24l8 8L-3 13Z" fill="#816a8c"/><path d="m-20 22 12-6-6-6Z" fill="#e3c5a5"/><path d="m10-16 8 8" stroke="#e0c694"/></g>
</g></template>
