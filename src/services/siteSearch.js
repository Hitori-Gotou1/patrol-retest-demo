import { activityCatalog } from '../data/activityCatalog.js';
import { siteSections } from '../data/siteSections.js';
import { journalNotes } from '../data/journal.js';
import { galleryImages } from '../data/gallery.js';
import { withAttribution } from '../data/galleryAttributions.js';
import { workTypes } from '../room/workshelf.js';
import { imageCharacters } from './galleryDiscovery.js';

const addedPages = [
  { id:'collections', path:'/collections', title:'主题合集', short:'主题相册 策展', description:'浏览开演之前、四个人的放学后等主题册。' },
  { id:'device', path:'/settings/device', title:'设备、离线与同步', short:'安装 桌面 离线 缓存 跨设备', description:'选择常用离线玩法，或主动连接自己的同步账号。' }
];
const normal = value => String(value || '').normalize('NFKC').toLowerCase();

function textOffsets(text, plain) {
  if (text.length === plain.length) return index => index;
  const offsets = [];
  const graphemes = typeof Intl.Segmenter === 'function'
    ? Array.from(new Intl.Segmenter().segment(text), part => part.segment)
    : Array.from(text);
  let original = 0;
  for (const character of graphemes) {
    for (let index=0; index<normal(character).length; index++) offsets.push(original);
    original += character.length;
  }
  return index => offsets[index] ?? text.length;
}

function markedParts(text, terms) {
  const plain = normal(text);
  const original = textOffsets(text,plain);
  const parts = [];
  let cursor = 0;
  let from = 0;
  while (cursor < plain.length) {
    const match = terms.map(term => ({ index:plain.indexOf(term,cursor),term }))
      .filter(item => item.index >= 0).sort((a,b) => a.index-b.index || b.term.length-a.term.length)[0];
    if (!match) break;
    const start = original(match.index);
    cursor = match.index + match.term.length;
    while (cursor < plain.length && original(cursor) === original(cursor-1)) cursor++;
    const end = original(cursor);
    if (start > from) parts.push({ text:text.slice(from,start) });
    parts.push({ text:text.slice(start,end), marked:true });
    from = end;
  }
  if (from < text.length) parts.push({ text:text.slice(from) });
  return parts;
}

function describeMatch(sources, terms) {
  const candidates = sources.filter(source => source.text).map(source => {
    const text = source.text.replace(/\s+/g,' ').trim();
    const plain = normal(text);
    const positions = terms.map(term => plain.indexOf(term)).filter(index => index >= 0);
    return { field:source.field,text,positions };
  });
  const source = candidates.sort((a,b) => b.positions.length-a.positions.length)[0];
  if (!source?.text) return null;
  const hit = source.positions.length ? textOffsets(source.text,normal(source.text))(Math.min(...source.positions)) : 0;
  const start = Math.min(Math.max(0,hit-17),Math.max(0,source.text.length-54));
  const end = Math.min(source.text.length,start+Math.max(60,...terms.map(term => term.length+20)));
  const snippet = (start ? '…' : '') + source.text.slice(start,end) + (end<source.text.length ? '…' : '');
  return { field:source.field, parts:markedParts(snippet,terms), hasMatch:source.positions.length>0 };
}

export function searchSite(query, { kind='all', works=[], cloud=[] }={}) {
  const terms = normal(query).trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const catalog = new Map(activityCatalog.map(activity => [activity.id,activity]));
  const activities = [...new Map([...activityCatalog,...siteSections,...addedPages].map(activity => [activity.id,activity])).values()];
  const entries = activities.map(activity => ({
    id:'activity-'+activity.id, kind:'activity', title:activity.title, description:activity.description, text:activity.short,
    icon:catalog.get(activity.id)?.icon || '', color:catalog.get(activity.id)?.color || '', action:catalog.get(activity.id)?.action || '打开专题', to:activity.path,
    sources:[{ field:'简介',text:activity.description },{ field:'简称',text:activity.short }]
  }));
  for (const note of journalNotes) {
    entries.push({
      id:'note-'+note.slug, kind:'note', title:note.title, description:note.summary, to:'/room/notes/'+note.slug,
      text:note.sections.map(section => section.text).join(' '),
      sources:[{ field:'摘要',text:note.summary },...note.sections.map(section => ({ field:'正文',text:section.text }))]
    });
  }
  for (const image of [...galleryImages,...cloud].map(withAttribution)) {
    const aliases = imageCharacters(image).flatMap(character => [character.label,...character.names,...character.latin]).join(' ');
    entries.push({
      id:'image-'+image.id, kind:'image', title:image.title, description:image.creator || '原作者待确认',
      text:[image.credit,image.alt,aliases].join(' '), thumbnail:image.thumbnail || image.src,
      to:{ path:'/',query:{ image:image.id },hash:'#gallery' },
      sources:[{ field:'画面',text:image.alt },{ field:'署名',text:image.creator },{ field:'来源',text:image.credit },{ field:'角色',text:aliases }]
    });
  }
  for (const work of works) {
    const tags = (work.tags || []).join('、');
    entries.push({
      id:'work-'+work.id, kind:'work', title:work.title, description:'我的作品 · '+tags, preview:work.preview,
      typeLabel:workTypes[work.kind]?.label || '我的作品', to:{ path:'/room/works',query:{ work:work.id } },
      sources:[{ field:'标签',text:tags }]
    });
  }
  const titleScore = entry => Number(terms.every(term => normal(entry.title).includes(term)));
  return entries.filter(entry => (kind==='all' || entry.kind===kind)
    && terms.every(term => normal(entry.title+' '+entry.description+' '+(entry.text || '')).includes(term)))
    .sort((a,b) => titleScore(b)-titleScore(a)).slice(0,60)
    .map(({ sources,...entry }) => ({ ...entry, match:describeMatch(sources,terms) }));
}
