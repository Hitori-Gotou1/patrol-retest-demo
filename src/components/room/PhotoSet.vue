<script setup>
defineProps({ theme: { type: String, required: true } });
</script>

<template>
  <g v-if="theme === 'pink'" aria-hidden="true">
    <defs>
      <linearGradient id="photo-classroom-wall" x1="0" x2="1" y1="0" y2="1">
        <stop stop-color="#b8879b"/><stop offset=".38" stop-color="#efd4ca"/><stop offset="1" stop-color="#e5aebd"/>
      </linearGradient>
      <linearGradient id="photo-classroom-sun" x1="0" y1="0" x2=".65" y2="1">
        <stop stop-color="#fff4b9" stop-opacity=".88"/><stop offset="1" stop-color="#fff1b8" stop-opacity=".04"/>
      </linearGradient>
    </defs>
    <path d="M32 108h656v650H32z" fill="url(#photo-classroom-wall)"/>
    <path d="M32 581h656v177H32z" fill="#bf8996"/>
    <path d="M32 580h656v14H32z" fill="#a46d80"/>
    <path d="M32 671h656M32 724h656M234 589 135 758m236-169 6 169m146-169 120 169"
      fill="none" stroke="#936579" stroke-opacity=".48" stroke-width="3"/>
    <path d="M26 164l219-23v232L26 437Z" fill="#faf0d8" stroke="#916780" stroke-width="10"/>
    <path d="m35 173 201-24v212L35 423Z" fill="#f9cda4"/>
    <path d="M36 329q42-41 83-31t117-30v93L35 423Z" fill="#bd9295"/>
    <path d="M32 310 241 258M93 159v244m79-256v230" fill="none" stroke="#fff5db" stroke-width="9"/>
    <path d="m23 435 230-70v14L23 455Z" fill="#f7e4cb"/>
    <path d="m94 399 81-24 389 277-157 43Zm87-26 57-17 423 266-83 26Z" fill="url(#photo-classroom-sun)"/>
    <path d="M558 176h140v165H558z" fill="#9c697c" stroke="#eed7bc" stroke-width="8"/>
    <path d="M582 211h85m-85 22h59m-59 31h84" stroke="#f4dce0" stroke-opacity=".66" stroke-width="3"/>
    <path d="M669 628h38v37h-38m-11-5v95m40-95v95M46 653h74v32H46m8 0v73m57-73v73" stroke="#8c5c71" stroke-width="5" fill="#ac7889"/>
  </g>
  <g v-else-if="theme === 'night'" aria-hidden="true">
    <defs>
      <radialGradient id="photo-stage-glow" cx=".5" cy=".27" r=".66">
        <stop stop-color="#625172"/><stop offset=".62" stop-color="#342a4a"/><stop offset="1" stop-color="#211930"/>
      </radialGradient>
    </defs>
    <path d="M32 108h656v650H32z" fill="url(#photo-stage-glow)"/>
    <path d="M32 567h656v191H32z" fill="#43344b"/>
    <path d="M32 617h656m-656 69h656m-463-119-127 191m274-191v191m120-191 136 191" stroke="#76617a" stroke-width="2" opacity=".68" fill="none"/>
    <path d="M165 131 87 578h268L187 131ZM540 123 400 578h254L561 123Z" fill="#efd0dc" opacity=".12"/>
    <path d="M33 107h131q-55 252-33 508L33 660ZM688 107H556q54 252 32 508l100 45Z" fill="#77425c"/>
    <path d="M79 109q2 258-17 524m64-515q-34 297-27 504m542-512q-3 256 18 524m-66-515q32 294 26 501" stroke="#c3768e" opacity=".37" stroke-width="9" fill="none"/>
    <path d="M530 506h79v93h-79zM541 442h63v59h-63z" stroke="#a791b5" stroke-width="4" fill="#302539"/>
    <circle cx="570" cy="552" r="24" fill="#53415f" stroke="#8d789e" stroke-width="3"/>
    <circle cx="572" cy="472" r="13" fill="#53415f" stroke="#8d789e" stroke-width="3"/>
    <path d="M34 734h654v24H34z" fill="#2c243a"/>
    <g v-for="(x, index) in [84, 222, 498, 636]" :key="x">
      <path :d="`M${x-20} 733h40l-8 15h-24Z`" fill="#191425" stroke="#826782" stroke-width="3"/>
      <ellipse :cx="x" cy="733" rx="16" ry="6" :fill="index % 2 ? '#f7d9ae' : '#eaa9cc'"/>
    </g>
    <path d="M174 122h370" stroke="#c7a3c3" stroke-width="4" opacity=".6"/>
    <g fill="#f7cecb"><circle cx="184" cy="130" r="8"/><circle cx="553" cy="127" r="8"/></g>
  </g>
  <g v-else aria-hidden="true">
    <path d="M32 108h656v650H32z" fill="#c6e0d5"/>
    <path d="M32 286h520v314H32z" fill="#ebcd9e"/>
    <path d="M32 299h143v298H32z" fill="#728e7b"/>
    <path d="M42 316h118v172H42z" fill="#d8e0bc" stroke="#486d65" stroke-width="9"/>
    <path d="M42 411h118M93 322v161" fill="none" stroke="#688c7b" stroke-width="5"/>
    <path d="M68 466h34v13H68m65-59h14v58h-14" fill="#b28e6e"/>
    <path d="M563 360h127v238H563z" fill="#b1c0a6"/>
    <path d="M582 390h67v135h-67z" fill="#e7ecd0" stroke="#7d9785" stroke-width="8"/>
    <path d="M612 392v130m-30-70h64" stroke="#7d9785" stroke-width="5"/>
    <path d="M32 592h656v166H32z" fill="#d8cab0"/>
    <path d="M32 636h656M32 693h656m-503-101-93 166m203-166-35 166m151-166 38 166m77-166 104 166"
      fill="none" stroke="#aaa58b" stroke-width="3"/>
    <path d="M32 594h656l-38 24H77Z" fill="#a8a68e" opacity=".7"/>
    <path d="M32 207h343l66 75H32Z" fill="#e8a58f"/>
    <path d="M59 207h44l14 75H69Zm89 0h45l23 75h-48Zm91 0h45l41 75h-51Zm91 0h45l66 75h-59Z" fill="#fff2c9"/>
    <path d="M32 280h409v16q-18 14-38 0-18 16-38 0-18 14-38 0-18 14-38 0-18 14-38 0-18 14-38 0-18 14-38 0-18 14-38 0-18 14-38 0-18 14-38 0-18 14-39 0Z" fill="#b67465"/>
    <path d="M601 607h71l-11 53h-47Z" fill="#aa795f"/>
    <path d="M636 613q-39-42-27-69 40 8 33 43 7-38 35-49 4 41-30 66" fill="#5c8970"/>
  </g>
</template>
