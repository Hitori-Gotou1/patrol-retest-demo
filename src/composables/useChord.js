import { ref, watch, onMounted, onUnmounted } from 'vue';
import { useInteractionAudio } from './useInteractionAudio.js';

// 旧纸箱剧场保留原接口，统一服从全站互动音效开关；不再创建第二个音效上下文。
export function useChord() {
  const playing = ref(false), message = ref('');
  const { enabled, play: playSound, stop } = useInteractionAudio('theater-chord');
  let timer, generation = 0;
  function pause() { generation++; clearTimeout(timer); stop(); playing.value = false; }
  async function play() {
    pause(); const token = generation;
    if (!enabled.value) { message.value = '静音练习中。开启导航中的音效，再听一声和弦。'; return; }
    const success = await playSound('chord');
    if (token !== generation) return;
    playing.value = success;
    message.value = success ? '和弦响起，今天也向前一点。' : '暂时无法播放，请再试一次。';
    if (success) timer = setTimeout(() => { playing.value = false; }, 1200);
  }
  function hidden() { if (document.hidden) pause(); }
  watch(enabled, value => { if (!value) pause(); });
  onMounted(() => document.addEventListener('visibilitychange', hidden));
  onUnmounted(() => { pause(); document.removeEventListener('visibilitychange', hidden); });
  return { playing, message, play };
}
