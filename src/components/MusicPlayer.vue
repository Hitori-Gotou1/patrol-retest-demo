<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import tracks from '../data/music.json'
import '../styles/music-player.css'

const emit = defineEmits(['play', 'pause'])
const audioElement = ref(null)
const spectrumCanvas = ref(null)
const selectedIndex = ref(0)
const isPlaying = ref(false)
const isLoading = ref(false)
const duration = ref(0)
const currentTime = ref(0)
const volume = ref(0.35)
const message = ref('')
const reducedMotion = ref(false)
const track = computed(() => tracks[selectedIndex.value])
const assetUrl = path => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`
const displayedDuration = computed(() => duration.value || track.value.duration)
const progress = computed(() => displayedDuration.value > 0 ? currentTime.value / displayedDuration.value * 100 : 0)

let context
let source
let analyser
let frequencyData
let animationFrame = 0
let mediaQuery
let requestId = 0
let wantsPlayback = false
let disposed = false

function formatTime(seconds) {
  const value = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`
}

function stopVisualization() {
  if (animationFrame) cancelAnimationFrame(animationFrame)
  animationFrame = 0
}

function drawSpectrum(live = false) {
  const canvas = spectrumCanvas.value
  const paint = canvas?.getContext('2d')
  if (!paint) return
  const { width, height } = canvas
  paint.clearRect(0, 0, width, height)
  paint.fillStyle = track.value.color
  const bars = 32
  const gap = 4
  const barWidth = (width - (bars - 1) * gap) / bars
  if (live && analyser && frequencyData) analyser.getByteFrequencyData(frequencyData)
  for (let index = 0; index < bars; index += 1) {
    // 只在实际播放时读取音频频谱；暂停/减少动态效果时显示安静的基线。
    const sample = live && frequencyData ? frequencyData[Math.floor(index * frequencyData.length / bars)] / 255 : 0
    const barHeight = Math.max(2, sample * (height - 4))
    paint.globalAlpha = live ? 0.5 + sample * 0.5 : 0.34
    paint.fillRect(index * (barWidth + gap), height - barHeight, barWidth, barHeight)
  }
  paint.globalAlpha = 1
}

function startVisualization() {
  stopVisualization()
  if (!analyser || reducedMotion.value || !isPlaying.value || document.hidden) {
    drawSpectrum(false)
    return
  }
  const frame = () => {
    animationFrame = 0
    if (disposed || !isPlaying.value || reducedMotion.value || document.hidden) return
    drawSpectrum(true)
    animationFrame = requestAnimationFrame(frame)
  }
  animationFrame = requestAnimationFrame(frame)
}

async function prepareAudio() {
  // AudioContext 仅由播放按钮或已播放状态下的手动切歌触发，不在挂载时创建。
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) return // 不支持频谱时仍可使用浏览器原生音频播放。
  if (!context) {
    context = new AudioContextClass()
    analyser = context.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.78
    frequencyData = new Uint8Array(analyser.frequencyBinCount)
    source = context.createMediaElementSource(audioElement.value)
    source.connect(analyser)
    analyser.connect(context.destination)
  }
  if (context.state !== 'running') await context.resume()
  if (context.state !== 'running') throw new Error('Audio context is suspended')
}

async function startPlayback(token = ++requestId) {
  const audio = audioElement.value
  if (!audio || disposed) return
  wantsPlayback = true
  isLoading.value = true
  message.value = ''
  try {
    await prepareAudio()
    if (token !== requestId || disposed || !wantsPlayback) return
    audio.volume = volume.value
    await audio.play()
    // 快速暂停、切歌或路由卸载可能使早先的 play Promise 晚到，旧请求不能更新新状态。
    if (token !== requestId || disposed) return
    isLoading.value = false
  } catch (error) {
    if (token !== requestId || disposed) return
    wantsPlayback = false
    isLoading.value = false
    isPlaying.value = false
    audio.pause()
    stopVisualization()
    drawSpectrum(false)
    message.value = error?.name === 'NotAllowedError'
      ? '浏览器暂未允许播放，请再点一次播放按钮。'
      : '暂时无法播放这段音频，请切换曲目或稍后再试。'
  }
}

function pause() {
  requestId += 1
  wantsPlayback = false
  isLoading.value = false
  audioElement.value?.pause()
  isPlaying.value = false
  stopVisualization()
  drawSpectrum(false)
}

defineExpose({ pause })

function togglePlayback() {
  if (isPlaying.value || (isLoading.value && wantsPlayback)) pause()
  else startPlayback()
}

async function selectTrack(index) {
  const nextIndex = (index + tracks.length) % tracks.length
  if (nextIndex === selectedIndex.value) return
  const resumeAfterChange = wantsPlayback && !audioElement.value?.paused
  pause()
  const token = requestId
  selectedIndex.value = nextIndex
  currentTime.value = 0
  duration.value = 0
  message.value = ''
  await nextTick()
  if (token !== requestId || disposed) return
  audioElement.value?.load()
  drawSpectrum(false)
  // 暂停状态下换歌仍保持暂停，只有原本正在播放时才续播。
  if (resumeAfterChange) startPlayback(token)
}

function onMetadata() {
  const value = audioElement.value?.duration
  duration.value = Number.isFinite(value) && value > 0 ? value : 0
}

function onTimeUpdate() {
  currentTime.value = audioElement.value?.currentTime || 0
}

function onPlay() {
  if (disposed || !wantsPlayback) {
    audioElement.value?.pause()
    return
  }
  isPlaying.value = true
  emit('play')
  startVisualization()
}

function onPlaying() {
  if (!wantsPlayback) return
  isLoading.value = false
  startVisualization()
}

function onPause() {
  isPlaying.value = false
  stopVisualization()
  drawSpectrum(false)
  emit('pause')
}

function onEnded() {
  pause()
  currentTime.value = duration.value
  message.value = '这一段练习结束了。要再听一次吗？'
}

function onError() {
  if (disposed) return
  pause()
  message.value = '音频暂时无法读取，请切换曲目或稍后再试。'
}

function seek(event) {
  const audio = audioElement.value
  if (!audio || !duration.value || audio.readyState === 0) return
  const target = Math.min(duration.value, Math.max(0, Number(event.target.value)))
  if (!Number.isFinite(target)) return
  try {
    audio.currentTime = target
    currentTime.value = target
  } catch {
    message.value = '音频还在准备中，请稍后拖动进度。'
  }
}

function changeVolume(event) {
  volume.value = Number(event.target.value)
  if (audioElement.value) audioElement.value.volume = volume.value
}

function updateMotionPreference() {
  reducedMotion.value = mediaQuery.matches
  startVisualization()
}

function onPageHidden() {
  pause()
  if (context?.state === 'running') context.suspend().catch(() => {})
}

function onVisibilityChange() {
  if (document.hidden) onPageHidden()
}

onMounted(() => {
  audioElement.value.volume = volume.value
  mediaQuery = matchMedia('(prefers-reduced-motion: reduce)')
  updateMotionPreference()
  mediaQuery.addEventListener('change', updateMotionPreference)
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('pagehide', onPageHidden)
  drawSpectrum(false)
})

onBeforeUnmount(() => {
  disposed = true
  pause()
  mediaQuery?.removeEventListener('change', updateMotionPreference)
  document.removeEventListener('visibilitychange', onVisibilityChange)
  window.removeEventListener('pagehide', onPageHidden)
  const audio = audioElement.value
  if (audio) {
    audio.removeAttribute('src')
    audio.load()
  }
  source?.disconnect()
  analyser?.disconnect()
  if (context && context.state !== 'closed') context.close().catch(() => {})
})
</script>

<template>
  <section class="music-player" :style="{ '--track-color': track.color }" aria-labelledby="music-title">
    <div class="music-heading">
      <div><span class="music-kicker">SOUND CHECK / 试听练习</span><h3 id="music-title">先听一小段。</h3></div>
      <span class="music-demo-note">本站原创 Demo · 非动画原曲</span>
    </div>
    <div class="music-deck">
      <div class="music-art" aria-hidden="true">
        <img class="music-sleeve" :src="assetUrl(track.cover)" alt="" width="240" height="240" loading="lazy" decoding="async">
        <div class="music-vinyl" :class="{ 'is-spinning': isPlaying && !reducedMotion }"><span class="music-vinyl-label">HITORI ROOM<strong>DEMO</strong><small>{{ String(selectedIndex + 1).padStart(2, '0') }} / 03</small></span></div>
      </div>
      <div class="music-console">
        <p class="music-now-label"><span :class="{ 'is-on': isPlaying }" aria-hidden="true"></span>{{ isPlaying ? 'NOW PLAYING' : 'READY WHEN YOU ARE' }}</p>
        <h4 class="music-track-title">{{ track.title }}</h4>
        <p class="music-track-subtitle">{{ track.subtitle }}</p>
        <canvas ref="spectrumCanvas" class="music-spectrum" width="320" height="52" aria-hidden="true"></canvas>
        <div class="music-timeline">
          <label class="visually-hidden" for="music-progress">播放进度</label>
          <input id="music-progress" class="music-range" type="range" min="0" :max="displayedDuration" step="0.1" :value="currentTime" :disabled="!duration" :aria-valuetext="`${formatTime(currentTime)}，共 ${formatTime(displayedDuration)}`" :style="{ '--range-progress': `${progress}%` }" @input="seek">
          <div class="music-time"><span>{{ formatTime(currentTime) }}</span><span>{{ formatTime(displayedDuration) }}</span></div>
        </div>
        <div class="music-controls">
          <div class="music-transport">
            <button type="button" class="music-skip" aria-label="上一首" @click="selectTrack(selectedIndex - 1)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5v14M19 5 8 12l11 7Z"/></svg></button>
            <button type="button" class="music-play" :aria-label="isPlaying || (isLoading && wantsPlayback) ? '暂停音乐' : '播放音乐'" :aria-busy="isLoading" @click="togglePlayback"><svg v-if="isPlaying || isLoading" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg><svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7Z"/></svg></button>
            <button type="button" class="music-skip" aria-label="下一首" @click="selectTrack(selectedIndex + 1)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 5v14M5 5l11 7-11 7Z"/></svg></button>
          </div>
          <label class="music-volume" for="music-volume"><span>音量</span><input id="music-volume" class="music-range" type="range" min="0" max="1" step="0.01" :value="volume" :aria-valuetext="`${Math.round(volume * 100)}%`" :style="{ '--range-progress': `${volume * 100}%` }" @input="changeVolume"></label>
        </div>
      </div>
      <ol class="music-tracklist" aria-label="原创演示曲目">
        <li v-for="(item, index) in tracks" :key="item.id"><button type="button" :class="{ 'is-current': index === selectedIndex }" :aria-current="index === selectedIndex ? 'true' : undefined" @click="selectTrack(index)"><span class="music-track-index">{{ String(index + 1).padStart(2, '0') }}</span><span class="music-track-name">{{ item.title }}<small>{{ item.subtitle }}</small></span><span class="music-track-length">{{ formatTime(item.duration) }}</span></button></li>
      </ol>
    </div>
    <p class="music-status" role="status" aria-live="polite">{{ message || (isLoading ? '正在准备音频…' : '按下播放，才让声音响起。') }}</p>
    <audio ref="audioElement" :src="assetUrl(track.src)" preload="metadata" @loadedmetadata="onMetadata" @durationchange="onMetadata" @timeupdate="onTimeUpdate" @play="onPlay" @playing="onPlaying" @pause="onPause" @waiting="isLoading = wantsPlayback" @ended="onEnded" @error="onError"></audio>
  </section>
</template>
