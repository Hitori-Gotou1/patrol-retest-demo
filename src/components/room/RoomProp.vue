<script setup>
defineProps({ kind: String, lit: Boolean });
</script>
<template>
  <g stroke="#574252" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">
    <g v-if="kind === 'guitar'"><path d="M-9-65h18v72c28-17 43 14 29 33-16 24-58 17-62-7-3-19 13-30 21-22V-65Z" fill="#db8a9e"/><path d="M-4-58h8V32h-8z" fill="#6e4c4b"/><circle cy="26" r="11" fill="#4a3945"/><path d="M-2-60v94M2-60v94M-9-63l-6 4m24-2 6 4M-8 44h18" stroke="#eedab0" stroke-width="1.5"/></g>
    <g v-else-if="kind === 'amp'"><rect x="-54" y="-42" width="108" height="86" rx="5" fill="#493f50"/><rect x="-45" y="-15" width="90" height="48" fill="#8f7f83"/><path v-for="i in 7" :key="i" :d="`M-44 ${-13+i*6}h88`" stroke="#685966" stroke-width="1"/><path d="M-18-43v-8h36v8" fill="none"/><circle cx="-33" cy="-29" r="4" fill="#ebce8f"/><circle cx="-15" cy="-29" r="4" fill="#ebce8f"/><circle cx="33" cy="-29" r="4" :fill="lit ? '#ffdf78' : '#b98594'"/><path d="M-40 45v7m80-7v7"/></g>
    <g v-else-if="kind === 'box'"><path d="m-59-19 25-22h72l21 22v60H-59z" fill="#d5b58a"/><path d="M-59-19H59M0-19v60M-59-19l-16-17 41-5M59-19l16-17-37-5" fill="#e9ce9f"/><path d="M-8-19H8v60H-8" fill="#c59b72" stroke="none"/><text x="0" y="19" text-anchor="middle" font-size="15" fill="#725546" stroke="none">ぼっち</text><path d="M-43 24v-13m-5 5 5-5 5 5" fill="none"/></g>
    <g v-else-if="kind === 'poster'"><rect x="-42" y="-59" width="84" height="118" fill="#65516c"/><path d="M-29-47h58M-29 34h58" stroke="#e4cc8c"/><text x="0" y="-15" text-anchor="middle" fill="#f4dc9e" stroke="none" font-size="20" font-weight="800">LIVE</text><text x="0" y="5" text-anchor="middle" fill="#f4dc9e" stroke="none" font-size="11">STARRY</text><path d="m6 12-14 17h11l-3 12 17-18H5Z" fill="#e7a1ba" stroke="none"/><path d="M-10-64h20v12h-20" fill="#d6bc91" stroke="none"/></g>
    <g v-else-if="kind === 'plant'"><path d="M-23 15h46l-7 34h-32Z" fill="#bd8c83"/><path d="M0 15V-39m0 26c-37 0-37-38-8-20M0 0c34-3 40-40 7-28M0-32c-14-36 23-38 10-2" fill="#8da797"/></g>
    <g v-else-if="kind === 'lamp'"><path d="M0-35v100m-28 0h56" fill="none" stroke-width="5"/><path d="m-24-70-18 45h84L24-70Z" :fill="lit ? '#ffe8a6' : '#f0d3ae'"/><path d="m-30-14-29 64H59L30-14" fill="#ffe1a4" opacity=".2" stroke="none"/></g>
    <g v-else-if="kind === 'photo'"><rect x="-60" y="-44" width="120" height="88" fill="#fff4df"/><rect x="-51" y="-35" width="102" height="61" fill="#c8c7d6"/><g v-for="(color,i) in ['#e5a1bc','#e8cb80','#8cbbd5','#d77f7c']" :key="color" :transform="`translate(${-36+i*24},-8)`"><circle r="10" :fill="color"/><path d="M-10 10h20v20h-20" :fill="color" stroke="none"/></g><path d="M-10 34h20" stroke="#ae8b83"/></g>
    <g v-else-if="kind === 'chair'"><path d="M-31-45h62v48h-62z" fill="#a0aabb"/><path d="M-37 3h74v18h-74z" fill="#d3b59c"/><path d="m-27 22-5 30m59-30 5 30M-23-44v-9h46v9" fill="none" stroke-width="5"/></g>
  </g>
</template>
