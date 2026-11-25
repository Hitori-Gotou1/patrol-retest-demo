<script setup>
import { computed, useId } from 'vue';
import StagePerformer from './StagePerformer.vue';

const props = defineProps({ view: String, beat: Number, embedded: Boolean });
const prefix = useId();
const link = name => `url(#${prefix}-${name})`;
const members = [
  { x: 282, y: 276, color: '#f490bd', instrument: 'guitar' },
  { x: 405, y: 239, color: '#f6c86c', instrument: 'drums' },
  { x: 533, y: 268, color: '#83acdd', instrument: 'bass' },
  { x: 657, y: 279, color: '#ef796e', instrument: 'voice' }
];
const movement = computed(() => [-13, -8, 0, 9, -18, -7, 8, 20][props.beat - 1] || 0);
const stickAngle = computed(() => [6, -8, 9, -13, 16, -34, 0, 25][props.beat - 1]);
const specks = Array.from({ length: 54 }, (_, i) => ({ x: 6 + (i * 173 + i * i * 31) % 886, y: 5 + (i * 91 + i * i * 13) % 463, r: i % 9 === 0 ? 1.35 : .7 }));
const audience = Array.from({ length: 12 }, (_, i) => ({ x: 26 + i * 83, y: 454 + (i * 19 % 29), size: 1 + (i % 3) * .12 }));
const views = { audience: '观众席的四人舞台', guitar: '一里手里的拨片与琴弦', drums: '虹夏抬起的鼓棒和鼓面', wing: '舞台侧面凉和喜多的眼神' };
</script>

<template>
  <svg :class="{ 'aftershow-stage-art': !embedded }" viewBox="0 0 900 490" role="img" :aria-label="`${views[view]}，第 ${beat} 拍`" :data-climax="beat === 8" :data-hesitation="beat === 5">
    <defs>
      <linearGradient :id="`${prefix}-wall`" x2="1" y2="1" gradientUnits="objectBoundingBox"><stop stop-color="#171624"/><stop offset=".56" stop-color="#30253d"/><stop offset="1" stop-color="#1b1729"/></linearGradient>
      <linearGradient :id="`${prefix}-floor`" x2="0" y2="1" gradientUnits="objectBoundingBox"><stop stop-color="#3e2c43"/><stop offset="1" stop-color="#171222"/></linearGradient>
      <radialGradient :id="`${prefix}-amber`"><stop stop-color="#ffc377" stop-opacity=".46"/><stop offset="1" stop-color="#ffd68a" stop-opacity="0"/></radialGradient>
      <radialGradient :id="`${prefix}-rose`"><stop stop-color="#e193ba" stop-opacity=".42"/><stop offset="1" stop-color="#e193ba" stop-opacity="0"/></radialGradient>
      <radialGradient :id="`${prefix}-blue`"><stop stop-color="#7b8dcb" stop-opacity=".46"/><stop offset="1" stop-color="#7b8dcb" stop-opacity="0"/></radialGradient>
      <linearGradient :id="`${prefix}-beam`" x2="0" y2="1" gradientUnits="objectBoundingBox"><stop stop-color="#ffe4aa" stop-opacity=".66"/><stop offset="1" stop-color="#e7a9c4" stop-opacity="0"/></linearGradient>
      <linearGradient :id="`${prefix}-shade`" x2="1" y2="0" gradientUnits="objectBoundingBox"><stop stop-color="#120f1e"/><stop offset=".55" stop-color="#211a2b"/><stop offset="1" stop-color="#3f2a43"/></linearGradient>
      <pattern :id="`${prefix}-paper`" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".77" fill="#f3d5bd" opacity=".12"/><circle cx="4.5" cy="4.5" r=".63" fill="#100e1b" opacity=".34"/></pattern>
      <pattern :id="`${prefix}-grille`" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r=".55" fill="#958393" opacity=".44"/></pattern>
    </defs>
    <rect width="900" height="490" :fill="link('wall')"/>

    <g v-if="view==='audience'">
      <path d="M0 24H900M0 49H900M100 24l38 25 36-25 38 25 36-25 38 25 36-25 38 25 36-25 38 25 36-25 38 25 36-25 38 25 36-25 38 25 36-25 38 25 36-25 38 25 36-25 38 25" stroke="#655367" fill="none" stroke-width="2" opacity=".7"/>
      <path d="M133 54h34L90 412h343Zm222 0h37L303 419h250Zm331 0h46L556 420h287Z" :fill="link('beam')" :opacity="beat===8 ? .95 : .79"/>
      <ellipse cx="322" cy="241" rx="260" ry="186" :fill="link('rose')"/><ellipse cx="578" cy="230" rx="260" ry="203" :fill="link('blue')"/>
      <ellipse cx="450" cy="235" rx="195" ry="150" :fill="link('amber')"/>
      <path d="M113 317H784L900 490H0Z" :fill="link('floor')" stroke="#77586f" stroke-width="2"/>
      <path d="M112 317 47 490M238 317l-28 173m130-173-14 173m128-173v173m109-173 16 173m97-173 44 173M789 318l60 172M69 374h759M38 413h828m-847 41h866" fill="none" stroke="#8e5e78" opacity=".27"/>
      <path d="M329 103h242v71H329z" fill="#211a2d" stroke="#a77387" stroke-width="2"/>
      <path d="M341 112h216v53H341z" fill="none" stroke="#6f506b" stroke-dasharray="3 4"/>
      <text x="448" y="153" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-weight="700" font-size="48" letter-spacing="7" fill="#f4c39e">STARRY</text>
      <g v-for="(x,index) in [53,763]" :key="x" :transform="`translate(${x} 233)`">
        <path d="M0 9 13 0h82v129l-13 13H0Z" fill="#211b2b" stroke="#806179" stroke-width="2"/><rect y="10" width="81" height="130" :fill="link('grille')"/>
        <circle cx="41" cy="51" r="25" fill="#251d2e" stroke="#634e63" stroke-width="3"/><circle cx="41" cy="51" r="9" fill="#423147"/><circle cx="41" cy="103" r="18" fill="#211b2c" stroke="#634e63" stroke-width="3"/><path d="M83 10 96 0M83 10v130" stroke="#594454"/>
        <text x="10" y="23" fill="#b38e9c" font-family="monospace" font-size="8">ST. {{index+1}}</text>
      </g>
      <g transform="translate(400 244)">
        <path d="M-51 20v70m95-66v66M-71 35H54" fill="none" stroke="#cead85" stroke-width="3"/><ellipse cx="-41" cy="23" rx="33" ry="7" fill="#d6ad78" stroke="#ffce7f" stroke-width="2"/><ellipse cx="50" cy="18" rx="22" ry="5" fill="#f2c879"/>
        <g transform="translate(3 -10) scale(.64)"><StagePerformer color="#f3c76d" instrument="voice" :movement="beat===6 ? 30 : movement * .7"/></g>
        <ellipse cx="3" cy="66" rx="35" ry="32" fill="#34283c" stroke="#e4ac75" stroke-width="4"/><circle cx="0" cy="66" r="22" fill="#231d31" stroke="#865c70" stroke-width="1.5"/>
        <path d="M-23 29 26 2m-6 16 33-27" fill="none" stroke="#fae1b1" stroke-width="3" stroke-linecap="round" :transform="beat===6 ? 'rotate(-19 10 26)' : ''" />
      </g>
      <g v-for="(member,index) in members.filter(m=>m.instrument!=='drums')" :key="member.x" :transform="`translate(${member.x} ${member.y+(beat===8 ? 5 : 0)}) scale(${index===1 ? .88 : .94})`">
        <StagePerformer :color="member.color" :instrument="member.instrument" :movement="index===0 && beat===5 ? -24 : movement" :frozen="index===0 && beat===5" />
      </g>
      <path v-if="beat===5" d="M248 268q14 13 38 8m-32-17 4-8m24 7 6-10" fill="none" stroke="#f3b4ca" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="4 5"/>
      <path v-if="beat===6" d="m392 204 8-22m9 24 11-14m-34 10-5-19" fill="none" stroke="#f8d897" stroke-width="2.5" stroke-linecap="round"/>
      <path v-if="beat>=7" d="m530 227 15-9m110 12 16-12m-407 12 15-11" fill="none" stroke="#ebc1d1" stroke-width="2" stroke-linecap="round" opacity=".8"/>
      <g v-for="(head,index) in audience" :key="head.x" :transform="`translate(${head.x} ${head.y}) scale(${head.size})`" :fill="index%2 ? '#201725' : '#110f1a'" stroke="#654f62" stroke-opacity=".7" stroke-width="1.6">
        <path d="M-52 42q8-41 35-39-18-12-11-32 5-20 28-20 22 0 29 15 8 22-12 37 26 1 37 40Z"/>
      </g>
    </g>

    <g v-else-if="view==='guitar'">
      <ellipse cx="344" cy="104" rx="342" ry="146" :fill="link('rose')"/><ellipse cx="755" cy="112" rx="215" ry="170" :fill="link('blue')"/>
      <g opacity=".53">
        <path d="M621 34h220v267H621Z" fill="#211b2d" stroke="#967089" stroke-width="2"/><rect x="637" y="52" width="188" height="231" :fill="link('grille')"/>
        <circle cx="735" cy="128" r="56" fill="#252033" stroke="#976d8a" stroke-width="2"/><circle cx="735" cy="128" r="14" fill="#3b2d45"/><circle cx="735" cy="231" r="33" fill="#201a2b" stroke="#976d8a" stroke-width="2"/>
        <path d="M844 303c15 22-21 27-61 30s-102-3-118 25 38 55 153 52" fill="none" stroke="#a8829e" stroke-width="4"/>
      </g>
      <path d="M-41-64 226-18l97 145-91 97L98 165-15 169Z" fill="#e59bbc" stroke="#21172a" stroke-width="9"/>
      <path d="M8 40 69 19l122 55 37 50-34 29-75-27-95 14M61 4l18 24m99-40 22 56-15 28M22 128l77-22" fill="none" stroke="#8f577f" stroke-width="3" opacity=".67"/>
      <path d="M-48 486q-27-88 39-169 55-69 137-62 33-83 106-97 116-28 182 43 36 37 16 62-21 30-1 55 83 64 40 118-16 21-48 31L377 508Z" fill="#232138" stroke="#e2a4bf" stroke-width="6"/>
      <path d="M-5 432q66 52 170 9t137-112q16-30-21-49-33-16-47-57c-19-37-93-16-128 34" fill="none" stroke="#6f5677" stroke-width="3"/>
      <path d="M285 321 764 154l16 37-477 166Z" fill="#9b644e" stroke="#171522" stroke-width="6"/>
      <path d="M276 326 759 160l14 24-481 164Z" fill="#3f2e3a"/>
      <path d="m753 151 80-43 57 14-10 27-102 45Z" fill="#cc9174" stroke="#1c1828" stroke-width="5"/>
      <path d="m784 151 33-18m4 11 46-19m-76 36 45-20m-27 26 43-17" stroke="#5d414b" stroke-width="3" fill="none"/>
      <g stroke="#cfaf9c" stroke-width="1.4" opacity=".8"><path v-for="n in 15" :key="n" :d="`M${304+n*28} ${315-n*9.7} l13 26`"/></g>
      <path d="m214 347 49-17 16 41-47 17zm-72 25 47-17 16 41-50 17z" fill="#bda593" stroke="#30253a" stroke-width="4"/>
      <g fill="none" stroke-linecap="round" :class="{'stage-string-ring':beat===8}">
        <path v-for="n in 6" :key="n" :d="`M${105+n*2} ${413+n*2.3} ${850+n*3} ${132+n*2.5}`" :stroke="n%2 ? '#f3cdb3' : '#c3add0'" :stroke-width="n<4 ? 1.3 : .85"/>
      </g>
      <g :transform="`translate(${beat===5 ? -12 : movement * .5} ${beat===5 ? -12 : movement*.8}) rotate(${beat===8 ? 7 : -3} 259 263)`">
        <path d="M176 93q34-7 63 22l61 58q21 19 18 45l-11 60-28 18-55-41-22-60-35-39Z" fill="#f1a5c5" stroke="#241b2e" stroke-width="6"/>
        <path d="m211 200 78 21m-70-10 67 20m-59-7 56 20" stroke="#9f5f86" stroke-width="3" opacity=".75"/>
        <path d="M229 217q23 3 57 21l24 29q7 9 1 15-4 6-12 0l-13-12 22 31q5 9-2 13-6 4-12-3l-21-22-16-1-21-22-18-18Z" fill="#f0c29f" stroke="#43283c" stroke-width="4"/>
        <path d="M239 238c17 3 21 8 30 20m-17-10 12 24m4-12 16 18" fill="none" stroke="#b37772" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M279 282 297 283 289 303q-5 2-8-5Z" fill="#f6abbd" stroke="#42293d" stroke-width="2.6"/>
      </g>
      <path v-if="beat===5" d="M275 274c25-11 48-1 58 15m-21-30 14-15m11 29 17-6" fill="none" stroke="#f3c5be" stroke-width="2" stroke-linecap="round" stroke-dasharray="4 5"/>
      <path v-if="beat>=7" d="m343 314 41-30m-37 47 62-31m-54 47 31-14" fill="none" stroke="#e1abce" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M526 427q33-27 59-31l23 8 45 7 12 15-3 9-133 11-21-5 2-8Z" fill="#392c45" stroke="#bf8aa6" stroke-width="2"/><path d="m520 439 141-11m-57-19 13 10m-6-12 19 7" stroke="#e4b4c7" stroke-width="1.5" opacity=".7"/>
    </g>

    <g v-else-if="view==='drums'">
      <ellipse cx="452" cy="148" rx="362" ry="205" :fill="link('amber')"/><ellipse cx="697" cy="121" rx="300" ry="201" :fill="link('rose')"/>
      <path d="M0 49h900M129 49l-31 83 42 7 24-90m367 0 35 92 40-9-30-83M38 52h823" fill="none" stroke="#9f7973" stroke-width="2" opacity=".6"/>
      <path d="m116 54 56 3 199 344H23Zm441 0 42-5 231 353H495Z" :fill="link('beam')" opacity=".56"/>
      <path d="M0 272h900v216H0Z" :fill="link('floor')"/><path d="M0 310h900M0 380h900M0 458h900M255 271 128 487m223-216-61 216m157-216-5 216m104-216 49 217m67-217 100 216" stroke="#af6f64" opacity=".38" fill="none"/>
      <path d="M-21 100q24 25 98 20m791-23q-45 18-97 11" fill="none" stroke="#af8290" stroke-width="2" opacity=".65"/>
      <g v-for="(c,index) in [{x:195,y:150,h:260},{x:691,y:145,h:274},{x:815,y:225,h:211}]" :key="c.x" :transform="`translate(${c.x} ${c.y})`">
        <path :d="`M0 0v${c.h}m0-39-38 50m38-50 45 50m-45-50v55`" fill="none" stroke="#4b3242" stroke-width="8"/>
        <path :d="`M0 0v${c.h}m0-39-38 50m38-50 45 50m-45-50v55`" fill="none" stroke="#b58f81" stroke-width="3"/>
        <g :transform="`rotate(${beat===6 && index===0 ? -8 : beat===8 ? 3 : -3})`">
          <ellipse cy="5" :rx="index===2?59:94" ry="18" fill="#9b654a" stroke="#3b2739" stroke-width="4"/><ellipse :rx="index===2?59:94" ry="15" fill="#d8a966" stroke="#563742" stroke-width="3"/>
          <ellipse :rx="index===2?43:70" ry="10" fill="none" stroke="#edcb8d" stroke-width="1.2"/><ellipse :rx="index===2?22:36" ry="6" fill="none" stroke="#987052" stroke-width="1.2"/><path d="M0 1V-9" stroke="#43313f" stroke-width="4" stroke-linecap="round"/>
        </g>
      </g>
      <g v-for="(drum,index) in [{x:364,y:296,w:126,h:40},{x:583,y:276,w:104,h:33},{x:211,y:373,w:110,h:39}]" :key="drum.x" :transform="`translate(${drum.x} ${drum.y})`">
        <path :d="`M${-drum.w} 0v65q${drum.w} ${drum.h*2} ${drum.w*2} 0V0Z`" :fill="index===0 ? '#a95d62' : '#8e5666'" stroke="#402d3b" stroke-width="4"/>
        <ellipse :rx="drum.w" :ry="drum.h" fill="#4a2c3d" stroke="#bc9179" stroke-width="7"/><ellipse :rx="drum.w-8" :ry="drum.h-6" fill="#ecce9f" stroke="#694e50" stroke-width="2"/>
        <ellipse :rx="drum.w-34" :ry="drum.h-13" fill="none" stroke="#bd8871" stroke-width="1.4" stroke-dasharray="5 5"/>
        <path :d="`M${-drum.w+18} ${drum.h-1}v53m${drum.w*.55} ${drum.h*.24}v48m${drum.w*.71} -1v-47m${drum.w*.58} -8v47`" fill="none" stroke="#d4a68c" stroke-width="3"/>
      </g>
      <path d="M-38 492q44-83 126-115l68-45 34 36-57 66-58 68ZM876 506q-34-70-121-102l-60-57-39 37 55 70 43 61Z" fill="#e0a373" stroke="#362538" stroke-width="7"/>
      <path d="m117 371 49 34m-40-43 48 34m504-23 43-37m-37 41 44-35" stroke="#a86f68" stroke-width="4" opacity=".75"/>
      <g :transform="`rotate(${stickAngle} 187 356)`">
        <path d="M176 350 468 196q11-5 12-3 1 3-9 10L187 367Z" fill="#f0cf98" stroke="#553a44" stroke-width="3"/>
        <path d="M145 357q0-14 18-25l39-1 20 10q6 7-3 13l-24-5 17 12q8 8 0 14-9 6-28-6l9 12q5 7-4 12-9 4-19-7Z" fill="#f6c5a2" stroke="#563b46" stroke-width="3"/>
      </g>
      <g :transform="`rotate(${beat===6 ? 23 : stickAngle * -.43} 675 360)`">
        <path d="M669 367 335 205q-12-5-14-2-2 3 9 10l330 174Z" fill="#f3d3a1" stroke="#553a44" stroke-width="3"/>
        <path d="M704 358q-6-17-24-23l-24 5-17 14q-6 9 1 12l23-6-16 15q-6 11 4 14 9 2 24-9l-7 12q-4 9 5 11 8 2 20-14Z" fill="#f6c5a2" stroke="#563b46" stroke-width="3"/>
      </g>
      <path v-if="beat===6" d="m480 170 16-21m-5 35 33-12m-20 29 34 0" fill="none" stroke="#f8da91" stroke-width="3" stroke-linecap="round"/>
      <g v-if="beat===8" fill="none" stroke="#fff1ae" stroke-width="2" opacity=".69"><ellipse cx="362" cy="297" rx="80" ry="23"/><ellipse cx="362" cy="297" rx="50" ry="16"/><ellipse cx="582" cy="276" rx="67" ry="17"/></g>
    </g>

    <g v-else>
      <path d="M29 153h869v335H32Z" :fill="link('shade')"/>
      <ellipse cx="693" cy="261" rx="355" ry="236" :fill="link('blue')"/><ellipse cx="329" cy="192" rx="300" ry="208" :fill="link('rose')"/>
      <path d="m791 17 32 9-210 413-242-79Z" :fill="link('beam')" opacity=".85"/>
      <path d="M0 402 442 292 900 453v37H0Z" :fill="link('floor')" stroke="#69506a" stroke-width="2"/>
      <path d="M300 324 580 490M198 350 343 490m88-193 375 192m-776-41 528-137M155 488l530-138" fill="none" stroke="#ad7792" stroke-width="1.4" opacity=".25"/>
      <path d="M0 0h141l-5 336 22 154H0Z" fill="#171221"/><path d="M18 0C6 198 51 344 34 490M78 0Q41 300 92 490m43-490-12 477" fill="none" stroke="#53364f" stroke-width="4"/>
      <path d="M123 19v300m-4-289-86 2" stroke="#77516c" fill="none" stroke-width="2" opacity=".74"/>
      <g transform="translate(281 311) scale(.55)"><StagePerformer color="#ee8fbc" :movement="movement" :frozen="beat===5" /></g>
      <g transform="translate(366 278) scale(.42)"><StagePerformer color="#f0c375" instrument="voice" :movement="beat===6 ? 25 : movement" /></g>
      <path d="M215 400 269 383l119 9 18 8-4 25-178 13-26-18Z" fill="#252036" stroke="#8c637e" stroke-width="2"/><path d="M207 404 387 405l13-7m-177 21 168-7" stroke="#634b65" stroke-width="2"/>
      <path d="M490 229q-83 10-133 107-27 55-27 157h288l-1-105q-7-121-57-143Z" fill="#6c93c6" stroke="#231a30" stroke-width="7"/>
      <path d="M446 274q44 24 106 90l34 72m-196 35 42-111m58-96 27 23" fill="none" stroke="#314c79" stroke-width="4" opacity=".77"/>
      <path d="M447 144q2-48 63-58 46-10 64 32l3 40 15 19-17 8-4 26-58 27-37-3-27-62Z" fill="#edbf9d" stroke="#32233b" stroke-width="5"/>
      <path d="M434 146q-11-41 10-64 30-35 71-29l34 10 31 36-19 3 18 42-37-30-14 28-13-23-16 42-18-11-2 43-31 6Z" fill="#7a9fce" stroke="#30263c" stroke-width="5"/>
      <path d="m554 158 13-3m-11 37 12 2" stroke="#46303c" stroke-width="3.4" stroke-linecap="round"/>
      <ellipse :cx="beat>=5 && beat<8 ? 567 : 559" cy="163" rx="2" ry="3.3" fill="#413142"/>
      <path d="M702 238q-78 15-93 147l20 108h260q9-98-28-178-20-40-65-60Z" fill="#d66d6e" stroke="#24182c" stroke-width="7"/>
      <path d="M711 278q42 30 83 37l40 146m-187-50 61-54" fill="none" stroke="#923953" stroke-width="4" opacity=".85"/>
      <path d="M819 169q6-58-57-69-51-4-72 38l-7 39-18 10 15 12 7 36 46 30 47-10 27-42Z" fill="#eec2a3" stroke="#332239" stroke-width="5"/>
      <path d="M681 154q-12-24 8-55 21-38 70-39 49-2 73 29l18 28-11 42 11 59-34 24-19-33-4-49-11-19-37 5-22-21-11 31Z" fill="#e98176" stroke="#332039" stroke-width="5"/>
      <path d="m689 177 14 4m-12 30 10 1" stroke="#4a2b3d" stroke-width="3.4" stroke-linecap="round"/>
      <ellipse :cx="beat>=6 && beat<8 ? 689 : 700" cy="184" rx="2" ry="3.3" fill="#483142"/>
      <path v-if="beat===7" d="M572 153q41-11 97 17m-36-18 9 10-13 3" fill="none" stroke="#ead394" stroke-width="2" stroke-linecap="round" stroke-dasharray="4 5"/>
      <path d="M101 448 255 464m-105-18 13 13-9 11m708-384 14 17-22 8" fill="none" stroke="#e5c396" stroke-width="2" opacity=".58"/>
    </g>

    <rect x="0" y="0" width="900" height="490" :fill="link('paper')" opacity=".51" pointer-events="none"/>
    <g fill="#f5bc9d" opacity=".33"><circle v-for="(point,index) in specks" :key="index" v-bind="{cx:point.x,cy:point.y,r:point.r}"/></g>
    <path d="M24 66V24h41m770 0h41v42m0 358v42h-41m-770 0H24v-42" fill="none" stroke="#ebbfad" stroke-width="1.3" opacity=".72"/>
  </svg>
</template>

<style scoped>
.aftershow-stage-art{display:block;width:100%;height:auto;aspect-ratio:900/490;overflow:hidden;background:#211b2e}
.stage-string-ring{animation:stage-string-resonance .32s ease-out both;transform-origin:350px 320px}
@keyframes stage-string-resonance{0%,100%{opacity:1}22%,67%{opacity:.58;transform:translateY(2px)}}
@media(prefers-reduced-motion:reduce){.stage-string-ring{animation:none}}
:global([data-motion=reduce]) .stage-string-ring,:global([data-aftershow-reduced=true]) .stage-string-ring{animation:none}
</style>
