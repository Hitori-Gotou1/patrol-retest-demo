<script setup>
defineProps({ scene: { type: String, required: true } });
</script>

<template>
  <svg class="theater-comic-art" viewBox="0 0 960 384" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <g stroke="#493447" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
      <g v-if="scene === 'box'">
        <path d="M146 340h416" stroke="#b69b84" stroke-width="2"/>
        <path d="M219 231h224l15 99H209Z" fill="#ba896d"/>
        <path d="M258 245c-3-74 33-96 81-96c53 0 72 44 72 96Z" fill="#efa1bf"/>
        <path d="M274 224q4-46 41-52m-19 49q7-29 25-45m36-2q30 18 35 45" fill="none" stroke="#ab597d" stroke-width="2.5"/>
        <path d="M268 200l-19-4 1-14 24 6Z" fill="#83c8e1"/>
        <path d="M265 215l-18-4 2-14 22 6Z" fill="#f5cc75"/>
        <path d="M210 227h245l-11 105H222Z" fill="#dfb38c"/>
        <path d="M210 227h245l-25 31H234Z" fill="#efcda1"/>
        <path d="M332 230h37l-18 59h-31Z" fill="#f7deb1" stroke="#ad806a" stroke-width="2"/>
        <path d="M244 308h44m-39 9h66m81-8h22" fill="none" stroke="#b68668" stroke-width="2"/>
      </g>
      <g v-else-if="scene === 'name'">
        <path d="M3 0l572 148L2 43Zm-3 91 537 84L1 121Zm0 199 548-60L1 329Zm7 90 572-110-480 114Z" fill="#ad677a" stroke="none" opacity=".4"/>
        <path d="M513 106l19 16m-15 176l30-12m111 34l11 34m91-291l-26 38" fill="none" stroke="#9c5b72" stroke-width="3"/>
        <path d="M552 374q12-83 81-88l44-4q80 20 91 92Z" fill="#df92b1"/>
        <path d="M555 249c-14-40-3-105 32-134 23-19 50-21 77-19 58 3 107 45 104 105l-12 115-35-18-18 15h-99l-24-17-35 14Z" fill="#ee9fbc"/>
        <path d="M586 201q4-35 68-53 55 9 71 58l-3 59q-7 29-62 42-60-13-73-49Z" fill="#ffe9d7"/>
        <path d="M573 187q11-66 78-66 36-1 65 33l25 61q-27 0-47-18l-21-25 1 30q-42-2-62-21l-29 39Z" fill="#efa1bf"/>
        <path d="M605 233l9 1m64 3 11 1m-45 30 10-2 7 7" fill="none"/>
        <ellipse cx="618" cy="243" rx="6" ry="11" fill="#557d9f" stroke-width="2"/>
        <ellipse cx="683" cy="248" rx="6" ry="11" fill="#557d9f" stroke-width="2"/>
        <path d="M581 205l-25-11 3-16 28 12Z" fill="#85c8e4"/>
        <path d="M578 222l-24-11 3-16 27 12Z" fill="#f1ca72"/>
        <path d="M774 106l14-29m0 42 20-15m-24 33 28-2" fill="none" stroke="#8b4c67"/>
      </g>
      <g v-else>
        <path d="M0 341Q503 317 960 92v292H0Z" fill="#c7a3bf" stroke="none"/>
        <path d="M0 362Q528 330 960 124" stroke="#9b6986" stroke-width="2" fill="none"/>
        <path d="M210 384q14-97 91-111h68q78 17 116 111" fill="#e49ab8"/>
        <path d="M203 234C179 109 239 49 331 51c73 2 124 60 120 133l12 110-54-14-40 24-109-13-15-22-57 22Z" fill="#ef9ebd"/>
        <path d="M235 159q29-43 98-48 49 11 76 63l-5 49q-12 43-73 54-63-13-87-59Z" fill="#ffe9d7"/>
        <path d="M224 168q5-76 80-91 54-8 93 26l32 81q-52-8-78-47l7 37q-42-7-71-43l-49 58Z" fill="#efa1bf"/>
        <path d="M258 192l17 5m78-12 14-1m-55 50q13 6 24-3" fill="none"/>
        <ellipse cx="275" cy="205" rx="6" ry="11" fill="#626c9b" stroke-width="2"/>
        <ellipse cx="362" cy="200" rx="6" ry="11" fill="#626c9b" stroke-width="2"/>
        <path d="M233 162l-25-10 3-15 27 10Z" fill="#81c7e3"/>
        <path d="M229 179l-24-9 3-16 26 11Z" fill="#f5cd76"/>
        <path d="M274 329q-43 20-15 58l29 14h100q61-17 41-70c-17-31-54-8-65-18-13-12-20-26-45-22-17 2-20 25-45 38Z" fill="#3c303c"/>
        <path d="M381 347L891 163l9 21-503 185Z" fill="#967160"/>
        <path d="M886 164l91-37v29l-78 34Z" fill="#433446"/>
        <path d="M384 351L960 145M391 356L960 151M398 361L960 157" stroke="#ffe6a9" stroke-width="2"/>
        <path d="M252 298q35 26 87 39l15 13q-1 14-20 12l-82-16m128-58q20 2 40 15l14 8q1 17-14 16l-35-8" fill="#ffe9d7"/>
        <path d="M302 369h47" stroke="#fff4dc" stroke-width="3"/>
      </g>
    </g>
  </svg>
</template>
