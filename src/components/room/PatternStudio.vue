<script setup>
import { useMediaFocus } from '../../composables/useMediaFocus.js';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router';
import { useInteractionAudio } from '../../composables/useInteractionAudio.js';
import { useSoundPreferences } from '../../composables/useSoundPreferences.js';
import { defaultPattern, studioTracks, validatePattern, patternBars, patternRange, toArrangement, editPatternBar, encodePattern, decodePattern, parsePatternFile, arrangementPosition } from '../../room/pattern.js';
import { loadLocal, downloadJson } from '../../room/storage.js';
import { createArrangementPlayer, renderArrangement, audioBufferWav, downloadAudioBlob, arrangementDuration } from '../../audio/arrangementEngine.js';
import { defaultTone, validateTone, guitarToneKey } from '../../room/effects.js';
import { recordActivity } from '../../room/activityLog.js';
import EditorWorkspace from '../tools/EditorWorkspace.vue';
import TemplateLibrary from '../tools/TemplateLibrary.vue';
import { createDraftPersistence } from '../../services/draftPersistence.js';
const claimMedia=useMediaFocus('studio',stop);
const key = 'hitori-room:studio:v1', route = useRoute(), router = useRouter();
const pattern = ref(loadLocal(key, defaultPattern, validatePattern));
const shared = ref(false), playing = ref(false), starting = ref(false), currentStep = ref(-1), playingBar = ref(-1), selectedBar = ref(0), message = ref(''), shareLink = ref(''), shareInput = ref(null), fileInput = ref(null);
const audio = useInteractionAudio('room-studio'), sounds = useSoundPreferences();
const useTone = ref(false), tone = ref(loadLocal(guitarToneKey, defaultTone, validateTone));
const exportCycles = ref(1), exporting = ref(false), exportProgress = ref(0);
const player = createArrangementPlayer({ createContext: () => new (window.AudioContext || window.webkitAudioContext)(), isHidden: () => document.hidden });
const selectedTrack=ref(0),stepPage=ref(0);
const bars = computed(() => patternBars(pattern.value)), masks = computed(() => bars.value[selectedBar.value]?.masks || bars.value[0].masks);
const range = computed(() => patternRange(pattern.value));
const exportLength = computed(() => { try { return `${arrangementDuration(pattern.value, exportCycles.value).toFixed(1)} 秒 + 2.4 秒尾音`; } catch { return ''; } });
watch(() => [sounds.preferences.effects, sounds.preferences.muted], () => { player.volume(sounds.effective('effects').value * 2); if (sounds.preferences.muted) stop(); });
watch(audio.enabled, value => { if (!value && playing.value) { stop(); message.value = '互动音效已关闭，合奏暂停了。'; } });
function chooseTone() { stop(); tone.value = loadLocal(guitarToneKey, defaultTone, validateTone); }
let frame, alive = true, importRevision = 0, generation = 0, exportController,draftExternal=false,skipExternalPersist=false;
const draftGuard=createDraftPersistence({key,fallback:defaultPattern,read:()=>validatePattern(pattern.value),replace:value=>{skipExternalPersist=true;pattern.value=value;},validate:validatePattern,canFlush:()=>!shared.value,onExternal:({invalid,conflict})=>{draftExternal=true;stop();if(conflict){message.value='编排存在同时修改，当前内容已保留；请在草稿冲突提示中选择版本或导出当前编排。';return;}shared.value=false;selectedBar.value=0;message.value=invalid?'另一标签或同步更新了编排，但新数据无法读取；已保护原记录，请先导出当前编排。':'已收到另一标签或设备的新编排，并停止旧稿播放；迟到的旧编辑不会覆盖它。';}});
const error = computed(() => { try { validatePattern(pattern.value); return ''; } catch (error) { return error.message; } });
function stop() { generation++; starting.value = false; playing.value = false; cancelAnimationFrame(frame); player.stop(); currentStep.value = -1; playingBar.value = -1; }
function persist() { if(draftGuard.conflicted){message.value='编排存在同时修改，请先处理草稿冲突；当前内容仍保留。';return false;}draftExternal=false; const saved=draftGuard.write();if(!draftExternal)message.value=saved?'编排已保存到本机。':'当前浏览器无法保存，请导出编排备份。';return saved; }
function tick() { if (!playing.value || !alive) return; const pos = arrangementPosition(player.elapsed(), pattern.value); currentStep.value = pos.step; playingBar.value = pos.bar; frame = requestAnimationFrame(tick); }
async function play() {
  if (starting.value || error.value) return;
  stop(); const token = ++generation; starting.value = true;
  try {
    const enabling = audio.setEnabled(true);
    const beginning = player.play(pattern.value, { loop: true, tone: tone.value, useTone: useTone.value, volume: sounds.effective('effects').value * 2 });
    const [enabled, ready] = await Promise.all([enabling, beginning]);
    if (!alive || token !== generation) return;
    if (document.hidden || !enabled || !ready) { stop(); message.value = sounds.preferences.muted ? '总静音已开启，请在声音设置中关闭后播放。' : '音频暂未准备好，请再点一次播放。'; return; }
    claimMedia(); starting.value = false; playing.value = true; message.value = '按所选循环范围播放；当前编辑的小节不会随播放跳走。'; frame = requestAnimationFrame(tick);
  } catch (error) { stop(); message.value = error.message; }
}
function toggle(track, step) { masks.value[track] ^= 1 << step; }
function barAction(action, index, destination) { try { stop(); pattern.value = editPatternBar(pattern.value, action, index, destination); selectedBar.value = Math.min(action === 'copy' ? index + 1 : action === 'move' ? destination : index, bars.value.length - 1); message.value = '小节已调整；循环范围恢复为全部小节。'; } catch (error) { message.value = error.message; } }
function setRange(part, value) { stop(); const next = toArrangement(pattern.value); next.loop[part] = Number(value); if (next.loop.start > next.loop.end) next.loop[part === 'start' ? 'end' : 'start'] = Number(value); pattern.value = validatePattern(next); }
watch(pattern, () => { shareLink.value = ''; selectedBar.value = Math.min(selectedBar.value, bars.value.length - 1); if (error.value) { stop(); return; } if(skipExternalPersist){skipExternalPersist=false;return;}if (!shared.value) persist(); }, { deep: true });
watch(() => JSON.stringify(pattern.value), () => { if (playing.value || starting.value) stop(); });
watch(() => route.query.pattern, raw => {
  stop(); shareLink.value = '';
  if (raw == null) { shared.value = false; pattern.value = loadLocal(key, defaultPattern, validatePattern); return; }
  try { shared.value = true; pattern.value = decodePattern(raw); selectedBar.value = 0; message.value = '正在试听分享的编排；保存后才会替换本机编排。'; } catch (error) { message.value = error.message; }
}, { immediate: true });
async function saveShared() { if (error.value) return; if (!persist()) return; shared.value = false; await router.replace({ path: '/room/studio' }); message.value = '这段编排已保存到本机。'; recordActivity('studio', pattern.value.name, JSON.stringify(pattern.value)); }
async function restore() { stop(); shared.value = false; pattern.value = loadLocal(key, defaultPattern, validatePattern); await router.replace('/room/studio'); message.value = '已恢复本机编排。'; }
function exportPattern() { if (!error.value) { downloadJson(validatePattern(pattern.value), 'hitori-room-pattern.json'); message.value = '已导出编排 JSON。'; recordActivity('studio', pattern.value.name, JSON.stringify(pattern.value)); } }
async function exportWav() {
  if (exporting.value || error.value) return; stop(); exporting.value = true; exportProgress.value = 0; exportController = new AbortController();
  try { const rendered = await renderArrangement(pattern.value, { cycles: exportCycles.value, tone: tone.value, useTone: useTone.value, signal: exportController.signal, onProgress: value => exportProgress.value = value }); if (!alive || exportController.signal.aborted) return; downloadAudioBlob(audioBufferWav(rendered.buffer), 'hitori-room-arrangement.wav'); message.value = `WAV 已生成：${rendered.duration.toFixed(2)} 秒，包含尾音。`; }
  catch (error) { if (alive) message.value = error.name === 'AbortError' ? '已取消音频导出，编排仍保留。' : error.message; }
  finally { if (alive) exporting.value = false; }
}
async function importPattern(event) { const file = event.target.files?.[0]; if (!file) return; const revision = ++importRevision; try { if (file.size > 16384) throw new Error('编排文件不能超过 16 KiB。'); const decoded = parsePatternFile(await file.text()); if (!alive || revision !== importRevision) return; stop(); shared.value = true; pattern.value = decoded; selectedBar.value = 0; message.value = '已打开导入的编排；确认保存后才会替换本机编排。'; } catch (error) { if (alive && revision === importRevision) message.value = error.message; } finally { if (alive) event.target.value = ''; } }
async function copy() { if (error.value) return; const url = new URL(router.resolve({ path: '/room/studio', query: { pattern: encodePattern(pattern.value) } }).href, window.location.href); url.search = ''; shareLink.value = url.href; try { await navigator.clipboard.writeText(url.href); if (alive) message.value = '编排链接已复制。'; } catch { if (!alive) return; message.value = '请选中下方链接复制。'; await nextTick(); shareInput.value?.focus(); shareInput.value?.select(); } }
function hidden() { if (document.hidden) { stop(); message.value = '已暂停播放，返回后可从头播放。'; } }
function captureDraft(event) { if (event.detail?.key === key) { draftGuard.adopt();try { event.detail.snapshot = validatePattern(pattern.value); } catch (error) { event.detail.error = error.message; } } }
function applyTemplate(value) { stop(); shared.value = false; pattern.value = validatePattern(value); selectedBar.value = 0; }
onMounted(() => { document.addEventListener('visibilitychange', hidden); window.addEventListener('hitori:capture-draft', captureDraft); });
onBeforeRouteLeave(() => { stop(); exportController?.abort(); });
onBeforeUnmount(() => { alive = false; draftGuard.destroy(); importRevision++; stop(); exportController?.abort(); player.dispose(); document.removeEventListener('visibilitychange', hidden); window.removeEventListener('hitori:capture-draft', captureDraft); });
</script>
<template>
<section class="room-panel" aria-labelledby="studio-title"><h2 id="studio-title">把四种声音，排成一句。</h2><p class="room-intro">一小节就能开始，也能把前奏、主歌排成完整段落。每四步是一拍，最多十六小节。</p>
<EditorWorkspace title="自己的编曲" save-label="导出编排" @save="exportPattern">
<template #canvas>
<div class="bar-tabs" role="group" aria-label="当前编辑小节"><button v-for="(bar,index) in bars" :key="bar.id" :aria-pressed="selectedBar===index" :class="{'bar-playing':playingBar===index}" @click="selectedBar=index">{{index+1}} · {{bar.name}}<span v-if="playingBar===index"> ♪ 播放中</span></button></div>
<p class="room-hint studio-position">正在编辑第 {{selectedBar+1}} 小节<span v-if="playingBar>=0"> · 正在播放第 {{playingBar+1}} 小节，第 {{currentStep+1}} 步</span></p>
<div class="studio-mobile-tools"><div role="group" aria-label="选择编辑轨道"><button v-for="(track,i) in studioTracks" :key="track.id" :aria-pressed="selectedTrack===i" @click="selectedTrack=i">{{track.label}}</button></div><div role="group" aria-label="选择节拍分段"><button :aria-pressed="stepPage===0" @click="stepPage=0">第 1–8 步</button><button :aria-pressed="stepPage===1" @click="stepPage=1">第 9–16 步</button></div></div><div class="studio-grid" aria-label="四轨十六步编排"><div v-for="(track,index) in studioTracks" :key="track.id" class="studio-track" :class="{'is-active-track':selectedTrack===index}"><strong>{{track.label}}</strong><div role="group" :aria-label="`${track.label}轨道`"><button v-for="step in 16" :key="step" type="button" :data-track="index" :data-step="step-1" :aria-label="`${track.label}第${step}步`" :aria-pressed="Boolean(masks[index] & (1 << (step-1)))" :class="{'is-current':playingBar===selectedBar&&currentStep===step-1,'is-beat':(step-1)%4===0,'mobile-step-hidden':Math.floor((step-1)/8)!==stepPage}" @click="toggle(index,step-1)">{{step}}</button></div></div></div>
</template>
<template #actions><button v-if="!playing" type="button" class="primary" :disabled="Boolean(error)||starting||exporting" @click="play">{{starting?'准备音效…':'播放并开启音效'}}</button><button v-else type="button" class="primary" @click="stop">停止播放</button><button v-if="shared" type="button" :disabled="Boolean(error)" @click="saveShared">保存为本机编排</button><button v-if="shared" type="button" @click="restore">恢复本机编排</button></template>
<template #tools>
<div class="room-fields"><label class="room-field">合奏名字<input id="pattern-name" v-model="pattern.name" maxlength="60"></label><label class="room-field">速度 BPM<input id="pattern-bpm" v-model.number="pattern.bpm" type="number" min="60" max="180" step="1"></label></div>
<label v-if="pattern.version===2" class="room-field">当前小节名称<input v-model="pattern.bars[selectedBar].name" maxlength="24"></label>
<div class="room-actions"><button @click="barAction('copy',selectedBar)">复制此小节 ＋</button><button :disabled="bars.length===1" @click="barAction('delete',selectedBar)">删除此小节</button><button :disabled="selectedBar===0" @click="barAction('move',selectedBar,selectedBar-1)">前移</button><button :disabled="selectedBar===bars.length-1" @click="barAction('move',selectedBar,selectedBar+1)">后移</button></div>
<div class="room-fields"><label class="room-field">循环起点<select :value="range.start" @change="setRange('start',$event.target.value)"><option v-for="(bar,i) in bars" :key="bar.id" :value="i">{{i+1}} · {{bar.name}}</option></select></label><label class="room-field">循环终点<select :value="range.end" @change="setRange('end',$event.target.value)"><option v-for="(bar,i) in bars" :key="bar.id" :value="i">{{i+1}} · {{bar.name}}</option></select></label></div>
<div class="studio-tone"><label class="room-check"><input id="studio-use-tone" v-model="useTone" type="checkbox" @change="chooseTone">使用我的吉他音色 · {{tone.name}}</label><RouterLink to="/room/effects">去效果器台调整 ↗</RouterLink></div>
<TemplateLibrary tool="studio" :current="pattern" @apply="applyTemplate"/>
<h3>把声音带走</h3><label class="room-field">导出循环次数<select v-model.number="exportCycles"><option v-for="n in [1,2,4,8,16]" :key="n" :value="n">{{n}} 遍所选范围</option></select></label><p class="room-hint">{{exportLength}} · WAV 上限三分钟；导出不需要麦克风。</p>
<div class="room-actions"><button type="button" :disabled="exporting||Boolean(error)" @click="exportWav">导出原创编曲 WAV</button><button v-if="exporting" @click="exportController?.abort()">取消导出</button></div><progress v-if="exporting" :value="exportProgress" max="1" aria-label="音频导出进度"></progress>
<div class="room-actions"><button type="button" :disabled="Boolean(error)" @click="copy">分享这段合奏</button><button type="button" :disabled="Boolean(error)" @click="exportPattern">导出编排 JSON</button><button type="button" @click="fileInput.click()">导入编排</button><input ref="fileInput" type="file" hidden accept=".json,application/json" aria-label="选择编排文件" @change="importPattern"></div>
</template></EditorWorkspace>
<div v-if="shareLink" class="room-share"><label class="room-field">合奏分享链接<input id="pattern-share" ref="shareInput" :value="shareLink" readonly @focus="$event.target.select()"></label></div><p class="room-status" role="status">{{error||message}}</p><p class="room-hint">本机编排自动保存。分享与导入需确认保存；老版单小节、作品架与分享链接仍可读取。所有声音为本站原创合成示范。</p></section>
</template>
<style scoped>
.bar-tabs{display:flex;gap:8px;overflow-x:auto;padding-bottom:8px}.bar-tabs button{white-space:nowrap;min-height:44px}.bar-playing{box-shadow:inset 0 -4px #b95d91}.studio-tone{padding:14px;background:#efe4df;border:1px solid #d6bfc9;margin-bottom:18px}.studio-tone a{font-size:13px;color:#76516a;min-height:44px;display:inline-flex;align-items:center}.studio-track{margin-block:14px}.studio-track>strong{display:block;font-size:13px;margin-bottom:8px}.studio-track>div{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:6px}.studio-track button{padding:8px 0;min-height:44px;min-width:0;font-size:12px}.studio-track button.is-beat{border-left:3px solid #9b7a65}.studio-track button.is-current{outline:3px solid #493b47;outline-offset:-5px}.studio-grid{min-width:0}.studio-mobile-tools{display:none}progress{width:100%;height:22px}@media(max-width:760px){.studio-mobile-tools{display:grid;gap:6px}.studio-mobile-tools>div{display:flex;gap:6px}.studio-mobile-tools button{flex:1;min-width:0;padding:6px 4px;min-height:44px}.studio-track{display:none;margin:8px 0}.studio-track.is-active-track{display:block}.studio-track>strong{display:none}.studio-track>div{grid-template-columns:repeat(4,minmax(0,1fr))}.studio-track .mobile-step-hidden{display:none}.studio-position{font-size:11px;margin:6px 0}.bar-tabs button{padding:6px 8px}.studio-grid{max-height:112px;overflow:auto}:deep(.is-fullscreen .editor-workspace-canvas){max-height:54%;overflow-y:auto;overscroll-behavior:contain}}
</style>
