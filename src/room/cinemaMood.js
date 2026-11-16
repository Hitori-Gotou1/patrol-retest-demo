import { loadLocal, saveLocal } from './storage.js';
export const cinemaMoodKey = 'hitori-room:cinema-mood:v1';
export const cinemaMoods = [
  { id: 'warm', name: '暖灯练习室', note: '留一盏灯，陪你慢慢练习。', icon: '◒' },
  { id: 'rain', name: '雨夜 STARRY', note: '霓虹映在窗上，今晚不用赶路。', icon: '☂' },
  { id: 'stage', name: '演出前夜', note: '四种颜色，等待同一个开场。', icon: '✦' }
];
export const validateCinemaMood = value => ({ version: 1,
  mood: cinemaMoods.some(m => m.id === value?.mood) ? value.mood : 'warm',
  dynamic: value?.dynamic !== false });
export const readCinemaMood = () => loadLocal(cinemaMoodKey, { version: 1, mood: 'warm', dynamic: true }, validateCinemaMood);
export const saveCinemaMood = value => saveLocal(cinemaMoodKey, validateCinemaMood(value));
