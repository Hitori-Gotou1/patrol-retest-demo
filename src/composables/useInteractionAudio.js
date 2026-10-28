import { onScopeDispose, readonly, ref } from 'vue';
import { createInteractionAudioEngine } from '../audio/interactionAudioEngine.js';

const enabled = ref(false), volume = ref(.18), message = ref('互动音效默认关闭。'), activeVoices = ref(0);
let engine, users = 0;

function hidden() { if (document.hidden) engine?.suspend(); }
function pageHidden() { engine?.suspend(); }
function getEngine() {
  if (!engine) {
    engine = createInteractionAudioEngine({
      createContext: () => {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) throw new Error('Web Audio unavailable');
        return new Audio();
      },
      isHidden: () => document.hidden,
      onState: state => {
        enabled.value = state.enabled;
        volume.value = state.volume;
        activeVoices.value = state.activeVoices;
        if (state.message) message.value = state.message;
      }
    });
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', pageHidden);
  }
  return engine;
}

/** 每个调用者有独立 owner；舞台退出只停止舞台声，不改变音乐播放器。 */
export function useInteractionAudio(owner = 'interaction') {
  const ownerId = Symbol(owner);
  const audio = getEngine();
  let disposed = false;
  users++;
  onScopeDispose(() => {
    disposed = true; audio.release(ownerId); users--;
    if (!users) {
      audio.dispose(); engine = null;
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', pageHidden);
    }
  });
  return {
    enabled: readonly(enabled), volume: readonly(volume), message: readonly(message), activeVoices: readonly(activeVoices),
    setEnabled: value => disposed ? Promise.resolve(false) : audio.setEnabled(value),
    setVolume: value => { if (!disposed) audio.setVolume(value); },
    play: (type, frequency) => disposed ? Promise.resolve(false) : audio.play(type, frequency, ownerId),
    stop: () => audio.stop(ownerId)
  };
}
