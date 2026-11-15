import { activityCatalog } from '../data/activityCatalog.js';
import { siteSections } from '../data/siteSections.js';
import { journalNotes } from '../data/journal.js';
import { galleryImages } from '../data/gallery.js';
import { withAttribution } from '../data/galleryAttributions.js';
import { imageCharacters } from './galleryDiscovery.js';
const addedPages=[{id:'collections',path:'/collections',title:'主题合集',short:'主题相册 策展',description:'浏览开演之前、四个人的放学后等主题册。'},{id:'device',path:'/settings/device',title:'设备、离线与同步',short:'安装 桌面 离线 缓存 跨设备',description:'选择常用离线玩法，或主动连接自己的同步账号。'}];
const normal=v=>String(v||'').normalize('NFKC').toLowerCase();
export function searchSite(query,{kind='all',works=[],cloud=[]}={}){
 const terms=normal(query).trim().split(/\s+/).filter(Boolean);if(!terms.length)return [];
 const entries=[...new Map([...activityCatalog,...siteSections,...addedPages].map(c=>[c.id,c])).values()].map(c=>({id:'activity-'+c.id,kind:'activity',title:c.title,description:c.description,text:c.short,to:c.path}));
 entries.push(...journalNotes.map(n=>({id:'note-'+n.slug,kind:'note',title:n.title,description:n.summary,to:'/room/notes/'+n.slug,text:n.sections.map(s=>s.text).join(' ')})));
 entries.push(...[...galleryImages,...cloud].map(withAttribution).map(i=>({id:'image-'+i.id,kind:'image',title:i.title,description:i.creator||'原作者待确认',text:[i.credit,i.alt,...imageCharacters(i).flatMap(c=>[c.label,...c.names,...c.latin])].join(' '),to:{path:'/',query:{image:i.id},hash:'#gallery'}})));
 entries.push(...works.map(w=>({id:'work-'+w.id,kind:'work',title:w.title,description:'我的作品 · '+(w.tags||[]).join('、'),to:{path:'/room/works',query:{work:w.id}}})));
 return entries.filter(e=>(kind==='all'||e.kind===kind)&&terms.every(t=>normal(e.title+' '+e.description+' '+(e.text||'')).includes(t))).sort((a,b)=>Number(terms.every(t=>normal(b.title).includes(t)))-Number(terms.every(t=>normal(a.title).includes(t)))).slice(0,60);
}
