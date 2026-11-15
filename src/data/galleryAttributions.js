import records from './gallery-attributions.json' with { type: 'json' };
import { httpsLink } from '../services/safeMedia.js';
export function attributionFor(item){const r=records[item.id];return {creator:r?.creator||item.creator||'',sourceUrl:httpsLink(r?.sourceUrl||item.sourceUrl),creatorUrl:httpsLink(r?.creatorUrl||item.creatorUrl),status:r?.status||item.status||'pending',method:r?.method||item.method||(item.creator?'站主记录':'原作者待确认'),note:r?.note||item.note||'站主提供的收藏，保留画面原有署名与水印。'};}
export function withAttribution(item){return {...item,...attributionFor(item)};}
