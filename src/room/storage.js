export function loadLocal(key, fallback, validate) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? validate(JSON.parse(raw)) : structuredClone(fallback);
  } catch { return structuredClone(fallback); }
}
export function saveLocal(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}
export function downloadJson(value, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2) + '\n'], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.click();
  if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('hitori:export',{detail:location.hash.split('/')[2]?.split('?')[0]}));
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
