<script setup>
defineProps({ card:{ type:String, required:true } });
</script>

<template>
  <svg viewBox="0 0 144 86" class="card-scene" aria-hidden="true" fill="none" stroke-linejoin="round" stroke-linecap="round">
    <rect width="144" height="86" fill="var(--card-paper,#ead8c8)"/>
    <g v-if="card === 'practice'">
      <g transform="rotate(-8 67 43)">
        <path d="M27 13h70v59H27Z" fill="#fff2d7" stroke="#806276" stroke-width="2"/>
        <path d="M38 27h48m-48 8h48m-48 8h48m-48 8h48" stroke="#b68c97"/>
        <path d="M52 43V29l13-4v14m11 8V34" stroke="#764b67" stroke-width="3"/>
        <circle cx="49" cy="45" r="4" fill="#764b67"/><circle cx="62" cy="41" r="4" fill="#764b67"/><circle cx="73" cy="48" r="4" fill="#764b67"/>
      </g>
      <path d="M88 60q28 7 30-14l-5-9m5 9 7-5-3 12" stroke="#9a5570" stroke-width="3.4"/>
    </g>
    <g v-else-if="card === 'solo'">
      <path d="m22 62 25-19q14-9 24 0l39-27 7 9-39 29q7 11-2 23-10 12-24 3L36 70Q13 79 22 62Z" fill="#a84f72" stroke="#614255" stroke-width="2.4"/>
      <path d="m58 62 61-42m-56 45 51-36" stroke="#f9e4bb" stroke-width="1.3"/>
      <path d="m110 14 15-8 8 9-17 13" fill="#e7bc79" stroke="#6c485c" stroke-width="2"/>
      <path d="m24 29 13 6m7-17 3 12" stroke="#f3d194" stroke-width="3"/>
    </g>
    <g v-else-if="card === 'count'">
      <ellipse cx="70" cy="57" rx="33" ry="18" fill="#f3d49e" stroke="#8a6258" stroke-width="2.5"/>
      <ellipse cx="70" cy="52" rx="31" ry="16" fill="#fbebcd" stroke="#8a6258" stroke-width="2"/>
      <path d="m27 17 55 31m33-31L64 48" stroke="#8d5146" stroke-width="7"/>
      <path d="m27 16 56 30m32-30L64 46" stroke="#d9a96d" stroke-width="4"/>
      <path d="M42 27v7m17-13v7m18-7v7m18 1v7" stroke="#a96753" stroke-width="1.8"/>
    </g>
    <g v-else-if="card === 'bass'">
      <path d="M16 11h112v66H16Z" fill="#9ab5c9" stroke="#556378" stroke-width="2"/>
      <rect x="44" y="26" width="60" height="35" rx="6" fill="#3a485f" stroke="#5f5871" stroke-width="3"/>
      <path d="M17 33h109M17 40h109M17 47h109M17 54h109" stroke="#f1dbc0" stroke-width="2.4"/>
      <path d="M32 18v52m81-52v52" stroke="#6c788b" stroke-width="5"/>
    </g>
    <g v-else-if="card === 'vocal'">
      <path d="M118 0 48 85H9L94 0Z" fill="#efc4ab"/>
      <path d="M56 78 77 44m-2 5 13-20" stroke="#65455b" stroke-width="6"/>
      <rect x="82" y="13" width="19" height="31" rx="9" fill="#dd899f" stroke="#60465e" stroke-width="2" transform="rotate(29 92 28)"/>
      <path d="m70 60-11 19h31m-33 0q-10-15-34-3" stroke="#665265" stroke-width="2.7"/>
      <path d="M106 24q11-3 21-10m-18 18 21-1" stroke="#a45e76" stroke-width="2.7"/>
    </g>
    <g v-else-if="card === 'encourage'">
      <path d="M33 40h80v30H33Z" fill="#916778" opacity=".45"/>
      <path d="M25 23q30-14 48 2 21-15 44-1l-5 37q-17-7-39 5-24-13-45-6Z" fill="#fff0d2" stroke="#9c786f" stroke-width="2"/>
      <path d="M73 26v39m-35-26q14-3 24 4m23 0q12-5 22-2" stroke="#bc8e80" stroke-width="2"/>
      <path d="m73 52-8-7q-3-7 8-4 11-3 8 4Z" fill="#b56c83"/>
      <path d="m20 11 8 7m95-7-8 8" stroke="#a76a62" stroke-width="3"/>
    </g>
    <g v-else-if="card === 'tune'">
      <rect x="36" y="13" width="66" height="57" rx="6" fill="#98afbd" stroke="#596173" stroke-width="2"/>
      <rect x="43" y="20" width="52" height="30" rx="4" fill="#e7e6cd" stroke="#677d7f" stroke-width="2"/>
      <path d="M51 44q16-27 36 0M69 43l8-13" stroke="#5a596a" stroke-width="2.4"/>
      <circle cx="69" cy="44" r="2.6" fill="#634258"/>
      <path d="M101 60q28-4 29 11-1 10-34 7M36 60q-22-1-24 11" stroke="#5d566c" stroke-width="3.5"/>
      <circle cx="56" cy="59" r="3" fill="#eac690"/><circle cx="83" cy="59" r="3" fill="#eac690"/>
    </g>
    <g v-else-if="card === 'box'">
      <path d="M30 37 43 24h50l21 13v38H30Z" fill="#be906e" stroke="#76545c" stroke-width="2"/>
      <path d="M58 33q-3-14 7-17 7-14 17 4 8 2 7 12Z" fill="#df9db9" stroke="#976579" stroke-width="2"/>
      <path d="m29 37-9-10 34 1 18 10 22-12 29 1-9 10Z" fill="#e7c79a" stroke="#76545c" stroke-width="2"/>
      <path d="M65 38h12v37H65Z" fill="#e5b686"/>
      <path d="M42 50h13" stroke="#80565a" stroke-width="3"/>
    </g>
    <g v-else-if="card === 'rest'">
      <ellipse cx="73" cy="69" rx="39" ry="9" fill="#cdac90" opacity=".65"/>
      <path d="M101 43h11q17 12-12 16M44 39h58q0 25-13 29H59Q44 61 44 39Z" fill="#f4dbab" stroke="#8d65a0" stroke-width="2.3"/>
      <ellipse cx="73" cy="39" rx="29" ry="8" fill="#a97662" stroke="#7b526c" stroke-width="2"/>
      <path d="M66 32q-16-10 1-16 10-5 2-11m13 27q15-9 3-15-9-5-2-10" stroke="#fffbeb" stroke-width="3.3"/>
    </g>
    <g v-else-if="card === 'flyer'">
      <path d="M0 57v-15l24-3 17-15 14 5 14 7q3 5-6 6l-11-2-17 13Z" fill="#e2a69b" stroke="#864e63" stroke-width="2"/>
      <path d="M144 32v18l-21 2-14 13-14-2-19-9q-4-5 3-8l17 3 14-14Z" fill="#ebbaa0" stroke="#864e63" stroke-width="2"/>
      <g transform="rotate(-9 71 45)"><path d="M43 33h56v8a5 5 0 0 0 0 9v8H43v-8a5 5 0 0 0 0-9Z" fill="#f3cd87" stroke="#b27a64" stroke-width="2"/><path d="M80 35v22" stroke="#a17165" stroke-dasharray="2 3"/><path d="M54 42h18m-18 7h14" stroke="#a17165" stroke-width="1.8"/></g>
      <path d="m31 52 20-9m62 2-18 8" stroke="#965e69" stroke-width="2.7"/>
    </g>
    <g v-else-if="card === 'unison'">
      <path d="M23 15 52 78H1zm33 0 27 63H25zm31 0 27 63H54zm32 0 25 63H90z" fill="#f1cdba" opacity=".63"/>
      <g v-for="(ink,i) in ['#c97596','#dfb779','#819fb9','#c77279']" :key="i" :transform="`translate(${27+i*29},41)`">
        <path d="M-11-8h22v17h-22Z" :fill="ink" stroke="#6e4d64" stroke-width="1.4"/>
        <path d="M0 10v21m-8 2 8-4 8 4m-14-35h12m-12 4h7" stroke="#654959" stroke-width="1.6"/>
      </g>
    </g>
    <g v-else>
      <path d="M22 17h103v53H22Z" fill="#f7edce" stroke="#8b687c" stroke-width="2"/>
      <path d="M34 33h79m-79 9h79m-79 9h79" stroke="#a9a8a0"/>
      <path d="M30 58q19-34 28-8 9 20 18-10t25-4" stroke="#5d738b" stroke-width="3"/>
      <path d="m92 67 22-39 7 5-22 40-8 5Z" fill="#d0a571" stroke="#805d67" stroke-width="2"/>
      <path d="M13 31v24m-4-19h8m-8 14h8" stroke="#8b687c" stroke-width="2"/>
    </g>
  </svg>
</template>
