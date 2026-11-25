<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { gsap } from 'gsap';
import { festivalStations } from '../../../data/festival.js';
import { reducedMotion } from '../../../room/preferences.js';
import { clamp } from '../../../room/festival/art.js';
import { expandFrames } from '../../../room/festival/animation.js';
import { editionLabel, snapshot, useFestivalDraft, useFestivalEditions } from '../../../room/festival/drafts.js';
import { assetArt, defaultCrop, foldIllustrations, initialZine, pageArt, pageRole, pageText, printSheetArt, sampleAsset, slotWith, zineLayouts } from '../../../room/festival/zine.js';
import FestivalArt from './FestivalArt.vue';
import FestivalExport from './FestivalExport.vue';
import FestivalStorage from './FestivalStorage.vue';
import './zine-print.css';

const { state, status, edit } = useFestivalDraft('zine', initialZine);
const collections = Object.fromEntries(festivalStations.slice(0, 3).map(({ id }) => [id, useFestivalEditions(id)]));
const mode = ref('edit');
const spread = ref(false);
const guides = ref(false);
const proof = ref(false);
const paper = ref(null);
const pagePicker = ref(null);
const pagesOpen = ref(false);
const foldBox = ref(null);
const foldStep = ref(0);
const foldOpen = ref(false);
const notice = ref('');
const activeSlot = ref(0);
const kind = ref('patch');
const version = ref('sample');
const variant = ref('front');
const first = ref(1);
const last = ref(1);

const variants = {
  patch: { front: '布章正面', back: '布章背面' },
  animation: { frame: '动画单格', strip: '动画帧条' },
  soundcheck: { compare: '试声前后对照图', before: '调整前线路图', after: '调整后线路图' }
};
const assetNames = { patch: '布章', animation: '动画', soundcheck: '试声单' };
const foldSteps = [
  '横向打印在 A4 纸单面，选实际大小。对折出中线，再把短边向中间折出四列。',
  '沿中线的红色实线剪开中间两格，两端留住。',
  '将纸沿长边对折，印刷面朝外。从左右向中间推开剪口，把四瓣立成十字。',
  '沿折痕把十字收拢，将 1 绕到最前，8 绕到最后。翻开检查 2—3、4—5、6—7。'
];
const drawings = foldIllustrations();
const pages = computed(() => state.value.pages);
const thumbnails = computed(() => pages.value.map((item, position) => pageArt(item, position + 1)));
const index = computed(() => Math.max(0, pages.value.findIndex(page => page.id === state.value.selected)));
const page = computed(() => pages.value[index.value]);
const activeLayout = computed(() => zineLayouts[page.value.layout]);
const selectedAsset = computed(() => page.value.slots[activeSlot.value]?.asset);
const textFit = computed(() => pageText(page.value, index.value + 1));
const editions = computed(() => collections[kind.value].state.value.items);
const selectedEdition = computed(() => editions.value.find(item => item.id === version.value));
const sourceData = computed(() => selectedEdition.value
  ? { kind: kind.value, variant: variant.value, data: selectedEdition.value.data, name: editionLabel(kind.value, selectedEdition.value), edition: selectedEdition.value.id }
  : sampleAsset(kind.value, variant.value));
const frames = computed(() => kind.value === 'animation' ? expandFrames(sourceData.value.data.frames) : []);
const pickedAsset = computed(() => ({ ...sourceData.value, first: first.value, last: variant.value === 'strip' ? last.value : first.value }));
const intakePreview = computed(() => assetArt(pickedAsset.value));
const printOptions = computed(() => ({ proof: proof.value, guides: true }));
const sheet = computed(() => mode.value === 'print' ? printSheetArt(pages.value, printOptions.value) : null);
const printed = computed(() => mode.value === 'print' ? printSheetArt(pages.value, printOptions.value) : null);
const pageNumber = number => `第 ${number} 页 · ${pageRole(number)}`;

function changePage(update) {
  const id = page.value.id;
  edit(draft => update(draft.pages.find(item => item.id === id)));
}

const title = computed({ get: () => page.value.title, set: value => changePage(draft => { draft.title = value; }) });
const caption = computed({ get: () => page.value.caption, set: value => changePage(draft => { draft.caption = value; }) });
const showPages = computed(() => {
  if (!spread.value || mode.value === 'edit') return [index.value];
  if (index.value === 0 || index.value === 7) return [index.value];
  const firstIndex = index.value % 2 === 0 ? index.value - 1 : index.value;
  return [firstIndex, firstIndex + 1];
});

const visiblePages = computed(() => showPages.value.map(position => ({
  position, page: pages.value[position],
  picture: pageArt(pages.value[position], position + 1, { guides: mode.value === 'edit' && guides.value })
})));

async function closePages() {
  if (!pagesOpen.value) return;
  pagesOpen.value = false;
  await nextTick();
  pagePicker.value?.focus({ preventScroll: true });
}

function selectPage(number) {
  const selected = pages.value[number];
  if (!selected) return;
  edit(draft => { draft.selected = selected.id; });
  activeSlot.value = 0;
  notice.value = '';
  void closePages();
}

function movePage(offset) {
  const oldIndex = index.value;
  edit(draft => {
    const [moving] = draft.pages.splice(oldIndex, 1);
    draft.pages.splice(oldIndex + offset, 0, moving);
  });
  notice.value = `已将稿页从第 ${oldIndex + 1} 页移到第 ${index.value + 1} 页`;
}

function changeLayout(key) {
  changePage(draft => { draft.layout = key; });
  activeSlot.value = 0;
}

async function changeMode(next) {
  mode.value = next;
  pagesOpen.value = false;
  if (next === 'edit' || reducedMotion()) return;
  await nextTick();
  if (paper.value) gsap.fromTo(paper.value, { rotationY: next === 'print' ? -11 : 11, opacity: .8 },
    { rotationY: 0, opacity: 1, duration: .36, ease: 'power2.out', clearProps: 'transform,opacity' });
}

function selectSource(event) {
  kind.value = event.target.value;
  version.value = 'sample';
  variant.value = Object.keys(variants[kind.value])[0];
}

function addToPage() {
  changePage(draft => { draft.slots[activeSlot.value] = slotWith(snapshot(pickedAsset.value)); });
  notice.value = `第 ${index.value + 1} 页已收稿 · ${sourceData.value.name}`;
}

function removeFromPage() {
  changePage(draft => { draft.slots[activeSlot.value] = slotWith(null); });
  notice.value = `已移出第 ${index.value + 1} 页的稿件`;
}

function crop(key, increment) {
  changePage(draft => {
    const crop = draft.slots[activeSlot.value].crop;
    crop[key] = clamp(crop[key] + increment, key === 'zoom' ? 1 : -1, key === 'zoom' ? 3 : 1);
  });
}

async function turnFold(offset) {
  foldStep.value = clamp(foldStep.value + offset, 0, foldSteps.length - 1);
  if (reducedMotion()) return;
  await nextTick();
  if (foldBox.value) gsap.fromTo(foldBox.value, { rotationX: -36, opacity: .7 },
    { rotationX: 0, opacity: 1, duration: .25, clearProps: 'transform,opacity' });
}

async function openPrint() {
  await document.fonts?.ready;
  window.print();
}

watch([version, kind], () => { first.value = 1; last.value = Math.min(5, frames.value.length) || 1; });
watch(first, value => { if (value > last.value) last.value = value; });
watch(last, value => { if (value < first.value) first.value = value; });
</script>

<template>
  <div class="fest-station fest-zine">
    <div class="fest-modebar" aria-label="小刊视图">
      <button type="button" :aria-pressed="mode === 'edit'" @click="changeMode('edit')">编辑桌</button>
      <button type="button" :aria-pressed="mode === 'read'" @click="changeMode('read')">屏幕阅读</button>
      <button type="button" :aria-pressed="mode === 'print'" @click="changeMode('print')">A4 单面折页</button>
    </div>
    <div v-if="mode !== 'print'" class="fest-zine-layout" :class="{ 'fest-reading-workbench': mode === 'read' }">
        <aside class="fest-zine-page-list" @keydown.esc.stop="closePages">
          <button ref="pagePicker" type="button" class="fest-page-picker" :aria-expanded="pagesOpen" aria-controls="fest-page-list" @click="pagesOpen = !pagesOpen">
            <strong>第 {{ index + 1 }} / {{ pages.length }} 页</strong>
            <span>{{ pageRole(index + 1) }} <span aria-hidden="true">{{ pagesOpen ? '−' : '+' }}</span></span>
          </button>
          <nav id="fest-page-list" class="fest-page-tabs" :class="{ 'fest-pages-open': pagesOpen }" aria-label="八页页序">
            <button v-for="(item, position) in pages" :key="item.id" type="button"
              :aria-label="`${pageNumber(position + 1)} · ${item.title || '未命名'}`" :aria-pressed="position === index" @click="selectPage(position)">
              <FestivalArt :picture="thumbnails[position]" />
              <span>{{ position + 1 }} <small>{{ pageRole(position + 1) }}</small></span>
            </button>
          </nav>
        </aside>
        <section class="fest-surface fest-paper-surface" aria-label="小刊版面">
          <div class="fest-surface-label fest-proof-label"><span>{{ mode === 'edit' ? '稿页校样' : '小刊预览' }}</span><span>{{ pageNumber(index + 1) }}</span></div>
          <div v-if="mode === 'read'" class="fest-button-row fest-surface-buttons">
            <button type="button" :aria-pressed="!spread" @click="spread = false">逐页阅读</button>
            <button type="button" :aria-pressed="spread" @click="spread = true">跨页校对</button>
          </div>
          <div ref="paper" class="fest-paper-pages" :class="{ 'fest-double': visiblePages.length === 2 }">
            <FestivalArt v-for="item in visiblePages" :key="item.page.id" :picture="item.picture" :label="`${pageNumber(item.position + 1)} · ${item.page.title}`" />
          </div>
          <div v-if="mode === 'read'" class="fest-button-row fest-surface-buttons">
            <button type="button" :disabled="index === 0" @click="selectPage(spread ? showPages[0] - 1 : index - 1)">上一页</button>
            <button type="button" :disabled="index === 7" @click="selectPage(spread ? showPages.at(-1) + 1 : index + 1)">下一页</button>
          </div>
          <div v-else class="fest-button-row fest-surface-buttons">
            <button type="button" :disabled="index === 0" @click="movePage(-1)">上移一页</button>
            <button type="button" :disabled="index === 7" @click="movePage(1)">下移一页</button>
            <button type="button" :aria-pressed="guides" @click="guides = !guides">文字安全区</button>
          </div>
          <FestivalStorage :status="status" />
          <p v-if="notice" class="fest-status" role="status">{{ notice }}</p>
        </section>
        <div v-if="mode === 'edit'" class="fest-controls">
          <section class="fest-panel">
            <h2>编辑第 {{ index + 1 }} 页</h2>
            <label class="fest-field">版式<select :value="page.layout" @change="changeLayout($event.target.value)"><option v-for="(layout, key) in zineLayouts" :key="key" :value="key">{{ layout.name }}</option></select></label>
            <label class="fest-field">短标题<input v-model="title" type="text" maxlength="100" :aria-invalid="textFit.title.overflow"></label>
            <label class="fest-field">图说或短文<textarea v-model="caption" rows="3" maxlength="260" :aria-invalid="textFit.caption.overflow"></textarea></label>
            <p v-if="textFit.title.overflow || textFit.caption.overflow" class="fest-fit-warning" role="status">
              {{ textFit.title.overflow ? '标题超出安全区。' : '' }}{{ textFit.caption.overflow ? '图说超出安全区。' : '' }} 校样以省略号标出，原文仍保留在草稿。
            </p>
          </section>
          <section class="fest-panel">
            <h2>选稿与裁切</h2>
            <div v-if="activeLayout.boxes.length > 1" class="fest-button-row" aria-label="当前稿位">
              <button type="button" :aria-pressed="activeSlot === 0" @click="activeSlot = 0">左图</button>
              <button type="button" :aria-pressed="activeSlot === 1" @click="activeSlot = 1">右图</button>
            </div>
            <p class="fest-hint">{{ selectedAsset ? `这页存的是 ${selectedAsset.name} 的快照。` : '当前稿位空着。' }}</p>
            <div v-if="selectedAsset" class="fest-button-row" aria-label="裁切调整">
              <button type="button" @click="crop('zoom', .2)">放大</button><button type="button" @click="crop('zoom', -.2)">缩小</button>
              <button type="button" @click="crop('x', -.25)">左移裁切</button><button type="button" @click="crop('x', .25)">右移裁切</button>
              <button type="button" @click="crop('y', -.25)">上移裁切</button><button type="button" @click="crop('y', .25)">下移裁切</button>
              <button type="button" @click="changePage(draft => { draft.slots[activeSlot].crop = defaultCrop(); })">复位裁切</button>
            </div>
            <label class="fest-field">稿件来源<select aria-label="稿件来源" :value="kind" @change="selectSource"><option v-for="(name, key) in assetNames" :key="key" :value="key">{{ name }}</option></select></label>
            <label class="fest-field">稿件版本
              <select aria-label="稿件版本" v-model="version"><option value="sample">可替换的示例稿</option><option v-for="edition in editions" :key="edition.id" :value="edition.id">{{ editionLabel(kind, edition) }}</option></select>
            </label>
            <label class="fest-field">选入内容<select aria-label="选入内容" v-model="variant"><option v-for="(name, key) in variants[kind]" :key="key" :value="key">{{ name }}</option></select></label>
            <div v-if="kind === 'animation'" class="fest-field-row">
              <label>{{ variant === 'frame' ? '选择一格' : '片段起格' }}<select :aria-label="variant === 'frame' ? '选择一格' : '片段起格'" v-model.number="first"><option v-for="item in frames" :key="item.slot" :value="item.slot">第 {{ item.slot }} 格 · 帧 {{ item.frameIndex + 1 }}</option></select></label>
              <label v-if="variant === 'strip'">片段止格<select aria-label="片段止格" v-model.number="last"><option v-for="item in frames" :key="item.slot" :value="item.slot">第 {{ item.slot }} 格 · 帧 {{ item.frameIndex + 1 }}</option></select></label>
            </div>
            <details class="fest-intake-details"><summary>预览选中的稿件</summary><FestivalArt :picture="intakePreview" :label="sourceData.name" /></details>
            <div class="fest-button-row">
              <button type="button" class="fest-primary" @click="addToPage">{{ selectedAsset ? '用选中稿件替换' : '把选中稿件放进来' }}</button>
              <button type="button" :disabled="!selectedAsset" @click="removeFromPage">移出这页</button>
            </div>
          </section>
        </div>
    </div>

    <section v-else class="fest-panel fest-print-panel" aria-label="A4 横向拼版">
      <div class="fest-print-heading">
        <div><h2>一张 A4，单面折成八页</h2><p class="fest-hint">选 A4 横向、实际大小。虚线折叠，红线只剪中间两格。</p></div>
        <button type="button" :aria-pressed="proof" @click="proof = !proof">{{ proof ? '查看真实稿件' : '切换页码与朝向校样' }}</button>
      </div>
      <div ref="paper" class="fest-sheet"><FestivalArt :picture="sheet" label="A4 横向拼版。上排倒置 5、4、3、2，下排正置 6、7、8、1。中线仅剪中央两格。" /></div>
      <div class="fest-button-row">
        <button type="button" class="fest-primary" @click="openPrint">打开 A4 打印预览</button>
        <FestivalExport v-slot="{ download, busy }"><button type="button" :disabled="busy" @click="download(() => printSheetArt(pages, printOptions), proof ? 'STARRY-A4拼版校样.png' : 'STARRY-A4八页小刊.png', 3)">下载高清整张 PNG</button></FestivalExport>
        <button type="button" :aria-expanded="foldOpen" @click="foldOpen = !foldOpen">{{ foldOpen ? '收起折叠示意' : '查看折叠示意' }}</button>
      </div>
      <div v-if="foldOpen" class="fest-fold-guide">
        <div ref="foldBox"><FestivalArt :picture="drawings[foldStep]" /></div>
        <div><h3>折纸第 {{ foldStep + 1 }} 步</h3><p>{{ foldSteps[foldStep] }}</p>
          <div class="fest-button-row"><button type="button" :disabled="!foldStep" @click="turnFold(-1)">上一步</button><button type="button" :disabled="foldStep === foldSteps.length - 1" @click="turnFold(1)">下一步</button></div>
        </div>
      </div>
      <Teleport to="body"><div class="festival-print" aria-hidden="true"><FestivalArt :picture="printed" /></div></Teleport>
    </section>
  </div>
</template>
