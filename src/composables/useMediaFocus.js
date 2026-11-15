import { onScopeDispose } from 'vue';
/** Long-form media share one listening space; short instrument taps remain independent. */
export function useMediaFocus(owner, stop) {
  const other = event => { if (event.detail?.owner !== owner) stop(); };
  const device = () => stop();
  window.addEventListener('hitori:media-start', other);
  window.addEventListener('hitori:audio-device-change', device);
  onScopeDispose(() => { window.removeEventListener('hitori:media-start', other); window.removeEventListener('hitori:audio-device-change', device); });
  return () => window.dispatchEvent(new CustomEvent('hitori:media-start', { detail: { owner } }));
}
