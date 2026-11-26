<script setup>
import { computed } from 'vue';
import { cast } from '../../data/playroom.js';

const props = defineProps({
  round:{ type:Object, required:true },
  tiles:{ type:Array, required:true },
  hazards:{ type:Object, required:true }
});
const size = 40;
const cell = (x,y) => x + ',' + y;
const boxTransform = ({ x,y }) => `translate(${x*size},${y*size})`;
const wall = computed(() => new Set(props.tiles.filter(t => t.tile === '#').map(t => cell(t.x,t.y))));
const view = computed(() => `0 0 ${(props.tiles.at(-1).x+1)*size} ${(props.tiles.at(-1).y+1)*size}`);
const castImage = import.meta.env.BASE_URL + cast[0].image;

function shape(locations) {
  return [...locations].map(id => {
    const [x,y] = id.split(',').map(Number);
    return `M${x*size} ${y*size}h${size}v${size}h-${size}Z`;
  }).join('');
}
function edges(locations) {
  return [...locations].map(id => {
    const [x,y] = id.split(',').map(Number), px=x*size, py=y*size;
    return [
      !locations.has(cell(x,y-1)) ? `M${px} ${py}h${size}` : '',
      !locations.has(cell(x+1,y)) ? `M${px+size} ${py}v${size}` : '',
      !locations.has(cell(x,y+1)) ? `M${px} ${py+size}h${size}` : '',
      !locations.has(cell(x-1,y)) ? `M${px} ${py}v${size}` : ''
    ].join('');
  }).join('');
}
const wallArea = computed(() => shape(wall.value));
const wallEdges = computed(() => edges(wall.value));
const brightArea = computed(() => shape(props.hazards.light));
const brightEdges = computed(() => edges(props.hazards.light));
</script>

<template>
  <svg class="maze-art" :viewBox="view" aria-hidden="true">
    <defs>
      <pattern id="maze-corrugation" width="8" height="8" patternUnits="userSpaceOnUse">
        <path d="M0 0h8v8H0z" fill="#937764"/>
        <path d="M0 3q2-4 4 0t4 0M0 6h8" fill="none" stroke="#6f554f" stroke-width=".75" opacity=".8"/>
      </pattern>
    </defs>
    <g v-for="tile in tiles.filter(t => t.tile !== '#')" :key="cell(tile.x,tile.y)"
      :data-floor="cell(tile.x,tile.y)" :data-lit="hazards.light.has(cell(tile.x,tile.y))">
      <rect :x="tile.x*size" :y="tile.y*size" width="40" height="40" fill="#4a4251" stroke="#695c6b" stroke-width=".55"/>
    </g>
    <path :d="wallArea" fill="url(#maze-corrugation)"/>
    <path :d="wallEdges" fill="none" stroke="#cead8a" stroke-width="2"/>
    <path :d="brightArea" class="maze-light-fill" fill="#e3c486"/>
    <path :d="brightEdges" fill="none" stroke="#ffe5a6" stroke-width="1.3" stroke-linejoin="round"/>
    <g v-for="tile in tiles.filter(t => ['E','K','D'].includes(t.tile))" :key="cell(tile.x,tile.y)" :transform="boxTransform(tile)">
      <g v-if="tile.tile === 'K' && !round.hasKey">
        <path d="M21 20 32 31m-4-4 4-4m-1 7 4-4" stroke="#f8d091" stroke-width="3.2" fill="none"/>
        <circle cx="15" cy="14" r="7" fill="#594854" stroke="#f7d08d" stroke-width="3"/>
      </g>
      <g v-else-if="tile.tile === 'D' && !round.hasKey">
        <path d="M7 34V6h26v28" fill="#735562" stroke="#eac0a7" stroke-width="2.6"/>
        <path d="M13 11v22m7-22v22m7-22v22" stroke="#b18a87" stroke-width="1.5"/>
        <circle cx="26" cy="21" r="2" fill="#f6d1a0"/>
      </g>
      <g v-else-if="tile.tile === 'E'">
        <path d="M5 36V6h30v30Z" :fill="round.hasKey ? '#466a59' : '#384d49'" stroke="#b7d3b9" stroke-width="2.5"/>
        <path d="M10 27h20m-10-11v5m-4 7 4 4 4-4" stroke="#e4e3bc" fill="none"/>
        <text x="20" y="16" text-anchor="middle" fill="#faefcf" font-family="monospace" font-weight="700" font-size="9">EXIT</text>
      </g>
    </g>
    <g v-for="lamp in hazards.lamps" :key="cell(lamp.x,lamp.y)"
      :data-lamp="cell(lamp.x,lamp.y)" :data-heading="lamp.heading"
      :transform="`translate(${lamp.x*size+20},${lamp.y*size+20}) rotate(${lamp.heading*90})`">
      <path d="M-13-6h18l8-4v20l-8-4h-18Z" fill="#4b3f50" stroke="#fff0b2" stroke-width="1.8"/>
      <path d="M12-8v16m4-5 5-3-5-3" fill="none" stroke="#fff5c7" stroke-width="2"/>
      <path d="M-15 9h12" stroke="#55414b" stroke-width="3"/>
    </g>
    <g v-for="(crowd,index) in hazards.crowds" :key="index" :transform="boxTransform(crowd)">
      <path d="M9 35q-2-17 11-17t12 17Z" fill="#26374a" stroke="#9bc0d6" stroke-width="1.6"/>
      <circle cx="20" cy="13" r="7" fill="#405b73" stroke="#9bc0d6" stroke-width="1.6"/>
    </g>
    <g v-for="box in round.boxes" :key="cell(box.x,box.y)" :transform="boxTransform(box)" :data-box="cell(box.x,box.y)">
      <rect x="6" y="9" width="31" height="28" rx="3" fill="#2d2630" opacity=".73"/>
      <path d="M4 5h31v28H4z" fill="#c7a077" stroke="#543e42" stroke-width="2"/>
      <path d="M16 5h7v28h-7Z" fill="#e9cfa0"/>
      <path d="M4 15h31m-23 4h5" stroke="#836353" stroke-width="1.5" fill="none"/>
      <path d="M10 20h7" stroke="#543e42" stroke-width="2.5" stroke-linecap="round"/>
    </g>
    <g :transform="boxTransform(round)" :data-player="cell(round.x,round.y)">
      <g v-if="round.hidden" class="maze-player-box">
        <path d="M15 19q-4-10 5-10 2 3 6 4l-4 6Z" fill="#e4a2c1" stroke="#64485d" stroke-width="1.4"/>
        <path d="M6 15h28v20H6Z" fill="#ddba8b" stroke="#805b60" stroke-width="2"/>
        <path d="M17 16h7v18m-14-13h7" stroke="#f6d9a3" stroke-width="2" fill="none"/>
      </g>
      <g v-else class="maze-player"><image :href="castImage" x="1" y="0" width="38" height="40" preserveAspectRatio="xMidYMax meet"/></g>
    </g>
  </svg>
</template>

<style scoped>
.maze-art { display:block; width:100%; height:auto; }
.maze-art .maze-player,.maze-art .maze-player-box { width:auto; height:auto; display:inline; position:static; transform:none; background:none; border:none; }
</style>
