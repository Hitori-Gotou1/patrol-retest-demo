import { computed, onScopeDispose, readonly, ref, watch } from 'vue';
import { useSoundPreferences } from './useSoundPreferences.js';
import { createInteractionAudioEngine } from '../audio/interactionAudioEngine.js';

const enabled = ref(false), volume = ref(.18), message = ref('互动音效默认关闭。'), activeVoices = ref(0);
let engine, users = 0;
const sounds = useSoundPreferences();
const preferredVolume = computed(() => sounds.preferences.effects);
watch(() => [sounds.preferences.effects, sounds.preferences.muted,sounds.preferences.effectsEnabled], () => { engine?.setVolume(sounds.effective('effects').value); if(sounds.preferences.muted||!sounds.preferences.effectsEnabled) { engine?.setEnabled(false); enabled.value=false; } });

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
        volume.value = sounds.preferences.effects;
        activeVoices.value = state.activeVoices;
        if (state.message) message.value = state.message;
      }
    });
    engine.setVolume(sounds.effective('effects').value);
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', pageHidden);
    window.addEventListener('hitori:audio-device-change',pageHidden);
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
      window.removeEventListener('hitori:audio-device-change',pageHidden);
    }
  });
  return {
    enabled: readonly(enabled), volume: readonly(preferredVolume), message: readonly(message), activeVoices: readonly(activeVoices),
    setEnabled: value => { if(disposed)return Promise.resolve(false); sounds.update({effectsEnabled:Boolean(value)}); if(value&&sounds.preferences.muted){message.value='总静音已开启，请在声音设置中关闭总静音后播放。';return Promise.resolve(false);} return audio.setEnabled(value); },
    setVolume: value => { if (!disposed) { sounds.update({effects:Math.max(0,Math.min(.5,Number(value)||0))}); audio.setVolume(sounds.effective('effects').value); } },
    play: async (type, frequency) => { if(disposed)return false; if(!enabled.value&&sounds.preferences.effectsEnabled&&!sounds.preferences.muted){if(!await audio.setEnabled(true))return false;} return audio.play(type,frequency,ownerId); },
    stop: () => audio.stop(ownerId)
  };
}
