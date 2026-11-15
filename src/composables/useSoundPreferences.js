import { computed, reactive, readonly, ref } from 'vue';
import { defaultSoundPreferences, soundPreferencesKey, validateSoundPreferences, soundGain } from '../audio/soundPreferences.js';
function read() { try { const raw = localStorage.getItem(soundPreferencesKey); return raw ? validateSoundPreferences(JSON.parse(raw)) : { ...defaultSoundPreferences }; } catch { return { ...defaultSoundPreferences }; } }
const state = reactive(read());
const deviceMessage=ref('');
if(typeof navigator!=='undefined')navigator.mediaDevices?.addEventListener('devicechange',()=>{deviceMessage.value='音频设备已变化。声音已暂停，点击原来的播放按钮即可重新连接；无声时可再试一次。';window.dispatchEvent(new Event('hitori:audio-device-change'));});
function update(patch) {
  Object.assign(state, validateSoundPreferences({ ...state, ...patch }));
  try { localStorage.setItem(soundPreferencesKey, JSON.stringify(state)); } catch {}
}
if (typeof window !== 'undefined') window.addEventListener('storage', event => { if (event.key === soundPreferencesKey) Object.assign(state, read()); });
export function useSoundPreferences() {
  return { deviceMessage:readonly(deviceMessage), preferences: readonly(state), update, effective: category => computed(() => soundGain(state, category)) };
}
