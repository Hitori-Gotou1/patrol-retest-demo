<script setup>
import { computed } from 'vue';
import { cast } from '../../data/playroom.js';
import { assetUrl } from '../../data/site.js';

const props = defineProps({ node:{ type:String,required:true }, story:{ type:String,required:true } });
const descriptions = {
  door:'走廊暗处，门把手下面漏出一道暖光。',
  knock:'虹夏摊开的掌心上搭着两根鼓棒。',
  hall:'音箱旁拖着一段琴线，喜多从走廊尽头的门探出来。',
  slow:'摊开的四小节，四个人围着谱子慢慢数拍。',
  melody:'舞台灯下四个人站在一起，声音接向同一小节。',
  rain:'车站顶棚下，凉拿着写了一半的谱，雨线落在站台边。',
  rhythm:'一只手点在手机的节拍格上，伞柄搭在桌边。',
  shop:'便利店的窗灯下，一张收据翻过来写上四道线。',
  space:'摊开的谱本留了一格空拍，早晨的光落在纸边。',
  relay:'四支笔把各自的一小段接在同一张折过的纸上。',
  lights:'散场的包里，露出一张写着谢谢的皱便签。',
  thanks:'虹夏拿起笔，在原来的一句谢谢旁写回复。',
  names:'四行签名写在便签上，留下一个小小的手画记号。',
  memory:'写着今天不错的便签夹在四个人的合影旁。',
  tomorrow:'合起的排练本压住便签，纸角还露在桌面上。'
};
const ground = computed(() => ({
  'first-rehearsal':'#554453',
  'rainy-evening':'#455a71',
  'after-the-show':'#584354'
})[props.story]);
const character = id => assetUrl(cast.find(member => member.id===id).image);
</script>

<template>
  <figure class="story-frame" :data-node="node">
    <svg viewBox="0 0 760 306" role="img" :aria-label="descriptions[node]">
      <rect width="760" height="306" :fill="ground"/>
      <g v-if="node==='door'">
        <path d="M62 0h70v306H62Z" fill="#3e3649"/><path d="M143 0h400l37 284-437-8Z" fill="#71566a" stroke="#956e7d" stroke-width="5"/>
        <path d="M542 0h24l53 280-39 4Z" fill="#e5be88"/><path d="m567 225 193-81v162H598Z" fill="#cea67f" opacity=".77"/>
        <path d="m165 35 358 10m-357 220 374 5" stroke="#8b6778" stroke-width="2"/>
        <rect x="438" y="92" width="52" height="103" rx="13" fill="#4a394e" stroke="#bb91a1" stroke-width="3"/>
        <circle cx="463" cy="126" r="14" fill="#caa282"/><path d="M464 127q5 11-5 13l-83-4q-11-6-1-15Z" fill="#e3c2a0" stroke="#695061" stroke-width="2"/>
        <circle cx="461" cy="171" r="6" fill="#201e2b"/><path d="m461 172-3 8h7Z" fill="#201e2b"/>
        <path d="M0 281q73-15 108-67l31 31q-9 27-56 61H0Z" fill="#c982a2"/><path d="M99 225q21-27 47-21l25 8q13 11-5 13l-22 3-11 15" fill="#efd1b6" stroke="#79576e" stroke-width="2"/>
      </g>
      <g v-else-if="node==='knock'">
        <path d="M0 37h760v190H0Z" fill="#885e64"/><path d="M538 17h155v184H538Z" fill="#ce9e7a"/><path d="M553 40h123v67H553Z" fill="#f1d5ab"/>
        <image :href="character('nijika')" x="54" y="37" width="215" height="217"/>
        <path d="M0 216 760 181v125H0Z" fill="#916f72"/><path d="M0 241 760 206" stroke="#be8e80" stroke-width="4"/>
        <path d="m249 306 48-67 45-17 22 84Z" fill="#bd9279" stroke="#614553" stroke-width="3"/>
        <path d="M313 240q22-35 52-38l79-9q21 2 10 18l-36 15 108-10q27 2 7 22l-114 30q-27 4-63 11Z" fill="#f0c699" stroke="#725161" stroke-width="4"/>
        <path d="M317 178 572 157q18 1 11 11l-263 21Z" fill="#f2d4a0" stroke="#71566a" stroke-width="3"/>
        <path d="m324 191 211-73q19 0 11 11l-215 73Z" fill="#dca773" stroke="#71566a" stroke-width="3"/>
      </g>
      <g v-else-if="node==='hall'">
        <path d="M0 226 381 104h379v202H0Z" fill="#776273"/><path d="M0 226 381 104 760 183M185 306l198-202m-17 202 54-201M564 306l-95-201" stroke="#ad8a90" stroke-width="2" fill="none"/>
        <path d="M416 45h203v174l-203 21Z" fill="#2d293d" stroke="#a77d90" stroke-width="7"/><path d="m455 50 145 3v162l-145 13Z" fill="#c6a18d"/>
        <image :href="character('kita')" x="452" y="58" width="145" height="165"/>
        <rect x="122" y="139" width="179" height="113" rx="7" fill="#403749" stroke="#c3a08e" stroke-width="4"/>
        <rect x="134" y="177" width="155" height="60" fill="#5f4c66"/><path d="M142 185h138m-138 9h138m-138 10h138m-138 10h138m-138 10h138" stroke="#9a7f8c" opacity=".7"/>
        <circle cx="144" cy="158" r="6" fill="#ead29b"/><circle cx="166" cy="158" r="4" fill="#ad8291"/><circle cx="185" cy="158" r="4" fill="#ad8291"/>
        <path d="M297 157c79 14 119 97 44 98s-101 27 9 30" fill="none" stroke="#322a3a" stroke-width="5"/>
      </g>
      <g v-else-if="node==='slow'">
        <path d="M0 188 760 146v160H0Z" fill="#a07b76"/><path d="M0 239 760 206" stroke="#c69885" stroke-width="3"/>
        <g v-for="(member,i) in cast" :key="member.id"><image :href="assetUrl(member.image)" :x="44+i*170" y="16" width="140" height="160"/></g>
        <path d="m146 174 438-22 35 125-484 15Z" fill="#f3dfb8" stroke="#715364" stroke-width="4"/>
        <path d="m161 207 430-21m-427 40 433-20m-429 42 435-22m-430 41 436-23m-373-57 12 84m80-88 15 84m84-90 17 83m82-88 22 82" stroke="#ad8385" stroke-width="2" fill="none"/>
        <g v-for="(member,i) in cast" :key="member.id" :fill="member.color"><circle :cx="204+i*97" :cy="231-i*4" r="9"/></g>
      </g>
      <g v-else-if="node==='melody'">
        <path d="M0 0q140 107 281 0 116 83 226 0 141 107 253 0v54H0Z" fill="#815969"/>
        <path d="M80 0h64l119 245H66Zm251 0h108l122 245H235Zm279 0h68l32 245H532Z" fill="#e5b78e" opacity=".38"/>
        <path d="M0 241h760v65H0Z" fill="#9c7380"/>
        <g v-for="(member,i) in cast" :key="member.id">
          <ellipse :cx="119+i*174" cy="253" rx="60" ry="12" fill="#413445" opacity=".37"/>
          <image :href="assetUrl(member.image)" :x="49+i*174" y="74" width="140" height="178"/>
        </g>
        <path d="M73 277q126 15 231 0t180 0 211-5" stroke="#e4b9a4" stroke-width="3" fill="none"/>
      </g>
      <g v-else-if="node==='rain'">
        <path d="M0 196 760 131v175H0Z" fill="#79808a"/><path d="M0 250 760 167" stroke="#dfc88e" stroke-width="8"/>
        <path d="M0 0h760v31L135 85 0 65Z" fill="#30384e"/><path d="M66 62v234m489-256v150" stroke="#354557" stroke-width="12"/>
        <path v-for="x in [22,75,127,178,231,282,332,394,449,505,557,614,666,719,769]" :key="x" :d="`M${x} 91l-28 53m55-30-36 68`" stroke="#bbc0d1" stroke-width="2" opacity=".67"/>
        <image :href="character('ryo')" x="170" y="76" width="212" height="209"/>
        <path d="m408 172 128-51 65 73-128 54Z" fill="#e2dccd" stroke="#666a82" stroke-width="3"/>
        <path d="m428 174 108-44m-102 58 108-44m-95 61 109-44m-101 57 70-29" stroke="#8d809a" stroke-width="2"/>
      </g>
      <g v-else-if="node==='rhythm'">
        <path d="M0 183 760 86v220H0Z" fill="#6f7788"/><path d="M0 220 760 124m-760 145 760-99" stroke="#8e92a7" stroke-width="3"/>
        <path d="M103 229 490 83q20-10 25 11 0 16-22 16l-375 146q-35 12-44-18-4-23 32-24" fill="none" stroke="#353648" stroke-width="10"/>
        <g transform="translate(281 70) rotate(13)">
          <rect width="205" height="215" rx="19" fill="#313047" stroke="#d2b0bd" stroke-width="4"/>
          <rect x="12" y="15" width="181" height="179" rx="10" fill="#e4d8d9"/>
          <path d="M33 83h136m-136 49h136m-101-48v48m35-48v48m35-48v48" stroke="#a0879f" stroke-width="2"/>
          <path d="M47 101v20m35-15v15m35-30v30m35-16v16" stroke="#7c6382" stroke-width="7"/>
        </g>
        <path d="M760 181q-102-42-167-4l-73 26-49-17q-23-2-27 8-2 9 17 17l68 36 231 28Z" fill="#edc0b4" stroke="#875f79" stroke-width="4"/>
        <path d="M760 184l-105 19v87l105 16Z" fill="#b75e76"/>
      </g>
      <g v-else-if="node==='shop'">
        <path d="M35 24h685v211H35Z" fill="#d9cab8"/><path d="M35 24h685v39H35Z" fill="#79a998"/><path d="M35 73h685v14H35Z" fill="#a98286"/>
        <path d="M54 104h651v85H54Z" fill="#a3b1b5"/><path d="M197 104v85m176-85v85m171-85v85" stroke="#e6ddd0" stroke-width="5"/>
        <path d="M0 222 760 189v117H0Z" fill="#ab9296"/>
        <path d="m274 155 221-27 83 142-273 21 9-17-15-11 5-15-14-13 6-16-15-14Z" fill="#fff0d3" stroke="#997186" stroke-width="3"/>
        <path d="m305 184 171-21m-160 42 180-21m-168 42 176-23m-165 45 172-23" stroke="#8b7391" stroke-width="3"/>
        <path d="m519 239 122-110 8 9-114 108-21 6Z" fill="#a37791" stroke="#51455e" stroke-width="3"/>
      </g>
      <g v-else-if="node==='space'">
        <path d="M0 0h760v306H0Z" fill="#917b83"/><path d="M583 0 760 0v211L456 306H186Z" fill="#e7c9a0" opacity=".7"/>
        <path d="M63 108q133-23 294 2 159-35 332-22l-14 178q-158-2-308 19-167-21-308-16Z" fill="#fff1d6" stroke="#815d6c" stroke-width="4"/>
        <path d="M357 110l10 175" stroke="#b08b8c" stroke-width="3"/>
        <path d="M86 148h245m-242 20h242m-240 19h240m-237 19h237m-233 19h233M395 145h251m-249 23h245m-244 20h242m-239 18h238m-234 20h231" stroke="#bd9d9b" stroke-width="2"/>
        <rect x="478" y="156" width="76" height="62" rx="3" fill="#f7dfbf" stroke="#936685" stroke-width="3" stroke-dasharray="7 4"/>
        <path d="m311 256 135-24 4 12-140 25-19-5Z" fill="#a37596" stroke="#675064" stroke-width="2"/>
      </g>
      <g v-else-if="node==='relay'">
        <path d="M0 42 760 6v300H0Z" fill="#7a6b82"/><path d="M0 141 760 94m-760 72 760-47m-760 151 760-56" stroke="#9d8197" stroke-width="2"/>
        <path d="M222 61 568 38 615 244 199 270Z" fill="#eedbc8" stroke="#4c4259" stroke-width="3"/>
        <path d="m257 94 272-12m-285 39 311-13m-314 37 328-13m-331 36 343-16m-347 39 351-14m-353 39 357-17" stroke="#b797a5" stroke-width="2"/>
        <g v-for="(member,i) in cast" :key="member.id" :stroke="member.color" fill="none" stroke-width="6" stroke-linecap="round">
          <path :d="`M${269+i*63} ${98+i*35}q14 -20 26 -5t25 4`"/>
          <path :d="`M${118+i*163} ${i%2?285:21}l${i%2?-53:34} ${i%2?-40:48}`" stroke-width="11"/>
        </g>
        <path d="m218 206 136-12 149 12 100-25" stroke="#d4b7ad" fill="none"/>
      </g>
      <g v-else-if="node==='lights'">
        <path d="M0 0h760v87Q581 54 407 91 169 45 0 103Z" fill="#352e40"/>
        <path d="M139 306 119 188q1-51 80-63l359-11q86 8 83 34l-28 158Z" fill="#805c73" stroke="#332a3d" stroke-width="8"/>
        <path d="m159 192 465-29" stroke="#b38a98" stroke-width="8" stroke-dasharray="4 4"/>
        <path d="m295 78 196-20 38 155-212 31-33-58 15-52Z" fill="#eed8b8" stroke="#87627c" stroke-width="3"/>
        <path d="m310 104 69 21 33-17 94 19m-196 70 69-29 60 12 74-42" fill="none" stroke="#be9d96" stroke-width="2"/>
        <text x="411" y="170" fill="#80536b" font-size="45" text-anchor="middle" transform="rotate(-7 411 170)">谢谢</text>
      </g>
      <g v-else-if="node==='thanks'">
        <path d="M0 194 760 108v198H0Z" fill="#a17e7a"/>
        <path d="m187 92 385-27 42 181-408 39Z" fill="#f4dfbd" stroke="#87697a" stroke-width="3"/>
        <path d="m226 129 312-32m-309 62 312-31m-306 62 195-16m-188 47 250-24" stroke="#bb9496" stroke-width="2"/>
        <text x="269" y="151" fill="#8f6280" font-size="27" transform="rotate(-6 269 151)">谢谢</text>
        <text x="327" y="205" fill="#675170" font-size="24" transform="rotate(-6 327 205)">我也想说这个</text>
        <path d="M760 125q-101-52-174-10l-46 49 35 34 185 14Z" fill="#ebc39b" stroke="#836077" stroke-width="4"/>
        <path d="m598 132-80 72-18-2 9-15 81-68Z" fill="#7b6684" stroke="#544255" stroke-width="2"/>
      </g>
      <g v-else-if="node==='names'">
        <rect x="82" y="47" width="592" height="219" rx="4" fill="#b18793" stroke="#d4acac" stroke-width="3"/>
        <path d="m179 49 384-11 23 223-402 13Z" fill="#f5e0c3" stroke="#7d5a73" stroke-width="4"/>
        <g v-for="([name,ink],i) in [['一里','#9b6285'],['虹夏','#866633'],['凉','#586a8e'],['喜多','#955a67']]" :key="name">
          <path :d="`M224 ${102+i*38}h310`" stroke="#c6a6a2" stroke-width="1.5"/>
          <text x="267" :y="97+i*38" :fill="ink" font-size="22" :transform="`rotate(${i%2?-4:2} 267 ${97+i*38})`">{{ name }}</text>
        </g>
        <path d="M474 172q21-29 31-7t-4 33q-17 8-27-6t7-12q29 20 40-2" fill="none" stroke="#68708b" stroke-width="3"/>
      </g>
      <g v-else-if="node==='memory'">
        <path d="M0 230 760 190v116H0Z" fill="#9a7683"/>
        <g transform="translate(212 20) rotate(-6)">
          <rect width="410" height="237" fill="#f4e2cf" stroke="#907287" stroke-width="3"/>
          <rect x="15" y="14" width="380" height="183" fill="#8e7290"/>
          <image v-for="(member,i) in cast" :key="member.id" :href="assetUrl(member.image)" :x="20+i*94" y="50" width="88" height="144"/>
        </g>
        <path d="m100 181 231-29 26 106-244 15Z" fill="#e6b9ac" stroke="#95677c" stroke-width="3"/>
        <path d="M120 182q-20-17-9-29l28-7q8 4 5 12l-16 9" fill="none" stroke="#e7d2ad" stroke-width="6"/>
        <text x="229" y="226" text-anchor="middle" fill="#643e57" font-size="28" transform="rotate(-7 229 226)">今天不错</text>
      </g>
      <g v-else-if="node==='tomorrow'">
        <path d="M0 170 760 99v207H0Z" fill="#9e7976"/><path d="M0 225 760 149m-760 101 760-74" stroke="#c29383" stroke-width="3"/>
        <path d="M107 0h235l142 306H262Z" fill="#dfb689" opacity=".49"/>
        <path d="m187 104 370-49 57 145-376 76Z" fill="#edd5bb" stroke="#564152" stroke-width="5"/>
        <path d="m207 131 370-49m-356 70 368-55m-358 76 368-61m-359 82 369-66" stroke="#a78585" stroke-width="2"/>
        <path d="m164 89 403-51 47 145-402 75Z" fill="#825b77" stroke="#624759" stroke-width="4"/>
        <path d="m188 102 67 143m-14-136 313-45" stroke="#ab7f89" stroke-width="3"/>
        <path d="m558 194 126-27 11 30-116 34Z" fill="#e7b7a3" stroke="#946a7e" stroke-width="3"/>
        <path d="m601 211 69-16m-60 21 40-10" stroke="#94718a" stroke-width="2"/>
      </g>
    </svg>
  </figure>
</template>

<style scoped>
.story-frame { margin:0; align-self:start; min-width:0; overflow:hidden; background:#49384b; border:4px solid #48384b; }
.story-frame svg { display:block; width:100%; height:auto; }
</style>
