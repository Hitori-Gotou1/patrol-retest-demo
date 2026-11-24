export const aftershowDraftKey = 'hitori-room:aftershow:v1';
export const inkOrder = ['pink', 'yellow', 'blue', 'red'];
export const aftershowViews = ['audience', 'guitar', 'drums', 'wing'];
export const aftershowPhases = ['stage', 'press', 'train'];
export const titleLimit = 18;
export const offsetLimit = 18;

function bounded(value, min, max, fallback = 0) {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : fallback;
}

function validView(view) {
  return aftershowViews.includes(view) ? view : 'audience';
}

export function plateOffset(value) {
  return { x: bounded(value?.x, -offsetLimit, offsetLimit), y: bounded(value?.y, -offsetLimit, offsetLimit) };
}

export function aftershowTitle(value) {
  return typeof value === 'string' ? Array.from(value.replace(/[\n\r\t]/g, ' ')).slice(0, titleLimit).join('') : '';
}

export function newPoster(view = 'audience', beat = 8) {
  return {
    view, beat, title: '', impressions: [],
    offsets: Object.fromEntries(inkOrder.map(ink => [ink, plateOffset()])),
    activeInk: inkOrder[0]
  };
}

export const defaultTrainPoster = {
  ...newPoster(),
  title: '散场以后',
  impressions: inkOrder.map(ink => ({ ink, ...plateOffset() }))
};

export const defaultAftershowDraft = {
  version: 1, phase: 'stage', view: 'audience', beat: 1,
  poster: newPoster(), progress: 0, flipped: false
};

export function validateAftershowDraft(draft) {
  const source = draft?.poster;
  const poster = newPoster(validView(source?.view), bounded(source?.beat, 1, 8, 8));
  poster.title = aftershowTitle(source?.title);
  if (inkOrder.includes(source?.activeInk)) poster.activeInk = source.activeInk;
  for (const ink of inkOrder) poster.offsets[ink] = plateOffset(source?.offsets?.[ink]);
  const seen = new Set();
  if (Array.isArray(source?.impressions)) {
    for (const layer of source.impressions) {
      if (!inkOrder.includes(layer?.ink) || seen.has(layer.ink)) continue;
      poster.impressions.push({ ink: layer.ink, ...plateOffset(layer) });
      seen.add(layer.ink);
      if (seen.size === inkOrder.length) break;
    }
  }
  const progress = bounded(draft?.progress, 0, 100);
  return {
    version: 1,
    phase: aftershowPhases.includes(draft?.phase) ? draft.phase : 'stage',
    view: validView(draft?.view),
    beat: bounded(draft?.beat, 1, 8, 1),
    poster, progress, flipped: progress === 100 && draft?.flipped === true
  };
}

export function nextUnprintedInk(poster) {
  const stamped = new Set(poster.impressions.map(layer => layer.ink));
  const currentIndex = inkOrder.indexOf(poster.activeInk);
  const ordered = [...inkOrder.slice(currentIndex + 1), ...inkOrder.slice(0, currentIndex + 1)];
  return ordered.find(ink => !stamped.has(ink)) ?? poster.activeInk;
}
