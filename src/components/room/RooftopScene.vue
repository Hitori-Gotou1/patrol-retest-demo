<script setup>
defineProps({ level:Number, width:Number, camera:Number });
const buildings = [12,395,838,1308,1682];
const lifts = [70,402,756,1095,1431,1740];
const color = [
  { sky:'#62506b', horizon:'#b48b92', roof:'#705b73', wall:'#836a7f', edge:'#a28590', deck:'#dbbea4' },
  { sky:'#29374b', horizon:'#68818c', roof:'#455971', wall:'#516374', edge:'#779098', deck:'#b9ced0' },
  { sky:'#352c4a', horizon:'#966888', roof:'#624c68', wall:'#6d4f6e', edge:'#a381a0', deck:'#ebc598' }
];
</script>

<template>
  <g aria-hidden="true">
    <defs><linearGradient id="jump-sky" x2="0" y2="1"><stop :stop-color="color[level].sky"/><stop offset="1" :stop-color="color[level].horizon"/></linearGradient></defs>
    <rect :width="width" height="520" fill="url(#jump-sky)"/>
    <g :transform="`translate(${-camera * .22},0)`" opacity=".72">
      <path d="M0 421v-84h97v-58h77v47h113v-37h124v-52h61v86h95v58h87v-94h103v42h74v-88h103v51h103v45h106v-59h100v53h157v-39h135v170H0Z" :fill="color[level].roof"/>
    </g>
    <g :transform="`translate(${-camera},0)`">
      <g v-if="level === 0">
        <g v-for="(x,index) in buildings" :key="x" :transform="`translate(${x},${232 + (index%3)*31})`">
          <path d="M0-9h238v253H0Z" :fill="color[level].wall" stroke="#a08696" stroke-opacity=".48" stroke-width="3"/>
          <path d="M18 20h83v58H18zm112 0h80v58h-80zm-112 90h83v58H18zm112 0h80v58h-80z" fill="#553e59" opacity=".76"/>
          <path d="M26 24h66v48H26zm114 0h61v48h-61z" fill="#d5a996" opacity=".61"/>
          <path d="M59 24v47m111-47v47M26 50h66m48 0h61" stroke="#9a7d89" stroke-width="4"/>
          <path d="M-12 80h245l19 26H-30Z" fill="#bb8b9a" stroke="#70566e" stroke-width="2"/>
          <path d="M25 80 12 106m49-26-9 26m53-26-2 26m39-26 4 26m41-26 8 26" stroke="#dfb0ae" stroke-width="7" opacity=".65"/>
        </g>
        <path d="M35 205v-24m89 12v-16m92 32v-23m1102 12v-31" stroke="#dab6ba" stroke-opacity=".5" stroke-width="2"/>
      </g>
      <g v-else-if="level === 1">
        <g v-for="(x,i) in lifts" :key="x" :transform="`translate(${x},${94+(i%3)*34})`" fill="none" stroke="#89a1a2" stroke-width="3" opacity=".74">
          <path d="M0 0h122v405H0ZM12 10h97v389H12ZM1 2l118 95L3 194l116 92L4 385M122 4 4 96l116 96L7 282l112 99"/>
          <path d="M0 0h122m-122 96h122m-122 96h122m-122 96h122m-122 100h122" stroke="#617489" stroke-width="9"/>
        </g>
        <path d="M0 475h1835m-1835 13h1835" stroke="#a0b1ae" opacity=".54" stroke-width="3"/>
      </g>
      <g v-else>
        <path d="M0 291q134-79 252-6t281-4q130-79 306-18t345-16 328 28 323 4V520H0Z" fill="#654760" opacity=".48"/>
        <g v-for="(x, index) in [78,449,813,1177,1514]" :key="x" :transform="`translate(${x},${98 + (index%2)*20})`">
          <path d="M0 29v387m21-387v387m0-382L2 68l18 38L2 145l18 37L2 221l18 37L2 296l18 36" fill="none" stroke="#92748d" stroke-width="4"/>
          <path d="M-49 4h151v24H-49Z" fill="#4d4058" stroke="#a8819a" stroke-width="3"/>
          <path d="M-38 9l20 14L0 9l20 14L40 9l20 14 20-14 15 14" stroke="#99778f" stroke-width="2" fill="none"/>
          <path d="M-29 29h34l-4 17h-25Zm87 0h31l-5 18H63Z" fill="#68495f" stroke="#d1a7a8" stroke-width="2"/>
          <path d="M-12 46-76 303H87Zm83 0 13 257h145Z" fill="#e6ab9d" opacity=".2"/>
        </g>
      </g>
    </g>
  </g>
</template>
