import { playroomCards } from './playroom.js';
import { adventureCards } from './adventures.js';
import { playgroundCards } from './playground.js';

export const activityGroups = [
  { id: 'creative', title: '做一件作品' },
  { id: 'play', title: '玩一小会儿' },
  { id: 'sound', title: '听听与练习' },
  { id: 'read', title: '读读与相遇' }
];
const groupIds = {
  creative: ['photobooth', 'comic', 'decorate', 'graffiti', 'lights', 'concert'],
  sound: ['ambient', 'effects', 'mix', 'echo', 'rhythm', 'studio', 'practice'],
  read: ['stories', 'notes', 'guestbook', 'relay', 'companion']
};
const extra = [
  { id: 'rhythm', title: '节奏练习', icon: '♫', description: '从四个按键开始，找到稳稳的节拍。', color: '#e8cd88' },
  { id: 'stories', title: '分支小剧场', icon: '▤', description: '替放学后的故事，选一个小小的下一步。', color: '#c5b2d5' },
  { id: 'studio', title: '十六步编曲', icon: '≋', description: '四条轨道、十六个落点，写自己的合奏。', color: '#a8c8bd' },
  { id: 'practice', title: '练琴计时', icon: '◷', description: '留一段专注的时间，慢慢靠近喜欢的声音。', color: '#adc8e4' },
  { id: 'notes', title: '小屋手记', icon: '✎', description: '角色小记、听歌札记，还有认真挑选的心动。', color: '#d9b3ca' },
  { id: 'guestbook', title: '留言与点歌', icon: '✉', description: '留下一句话，或把喜欢的一首歌推荐给大家。', color: '#b8c4a5' }
];
const lengths={photobooth:2,decorate:5,walk:5,search:2,concert:5,ambient:0,maze:5,effects:5,companion:2,echo:2,escape:10,duet:5,cards:10,jigsaw:5,shop:5,platform:5,lights:10,comic:10,mix:5,graffiti:10,relay:2,pinball:5,rhythm:2,stories:5,studio:10,practice:10,notes:5,guestbook:2};
const challenging=new Set(['maze','escape','cards','platform','pinball','rhythm','echo','mix']);
export function filterActivities(cards,{query='',group='all',duration='all',difficulty='all'}={}){const terms=query.normalize('NFKC').toLowerCase().trim().split(/\s+/).filter(Boolean);return cards.filter(c=>(group==='all'||c.group===group)&&(duration==='all'||(duration==='free'?c.minutes===0:duration==='10'?c.minutes>=10:c.minutes===Number(duration)))&&(difficulty==='all'||c.difficulty===difficulty)&&terms.every(t=>(c.title+' '+c.short+' '+c.description).normalize('NFKC').toLowerCase().includes(t)));}
export const activityCatalog = [...playroomCards, ...adventureCards, ...playgroundCards, ...extra].map(card => ({
  ...card, minutes:lengths[card.id]??5,difficulty:challenging.has(card.id)?'challenge':'easy', group: Object.keys(groupIds).find(group => groupIds[group].includes(card.id)) || 'play',
  path: `/room/${card.id}`, short: card.short || card.title, action: card.action || '进去看看'
}));
export const featuredActivities = [
  { id: 'photobooth', eyebrow: '留一张合影', duration: '约 2 分钟', image: 'assets/activities/photobooth.webp', position: '50% 44%', note: '四个人，一张属于你的照片。' },
  { id: 'comic', eyebrow: '画一段日常', duration: '约 10 分钟', image: 'assets/activities/comic.webp', position: '50% 48%', note: '把没说完的话，写进四个画面。' },
  { id: 'ambient', eyebrow: '听一场夜雨', duration: '随时坐坐', image: 'assets/activities/ambient.webp', position: '50% 50%', note: '雨声、试音，以及不用赶路的夜晚。' }
].map(feature => ({ ...activityCatalog.find(card => card.id === feature.id), ...feature }));
export const findActivity = path => activityCatalog.find(card => card.path === path);
export const nextActivities = {
  photobooth: ['decorate', 'comic'], comic: ['graffiti', 'photobooth'], decorate: ['photobooth', 'ambient'],
  graffiti: ['lights', 'comic'], lights: ['studio', 'graffiti'], studio: ['effects', 'lights'],
  ambient: ['notes', 'decorate'], effects: ['studio', 'mix'], concert: ['graffiti', 'lights']
};
