import {defaultPattern,validatePattern} from './pattern.js';
import {newLightShow,validateLightShow} from './creativeTools.js';
import {defaultTone,validateTone} from './effects.js';
import {rasterData} from '../services/safeMedia.js';
export const defaultProject={version:1,name:'今晚，四种颜色一起',pattern:defaultPattern,lights:newLightShow(),tone:defaultTone,useTone:false,backdrop:'',poster:'',cycles:4};
export function validateProject(v){if(!v||v.version!==1||typeof v.name!=='string'||!v.name.trim()||v.name.length>60)throw new Error('演出项目需要60字以内的名称。');for(const key of ['backdrop','poster'])if(v[key]&&!rasterData(v[key],key==='backdrop'?1500000:180000))throw new Error('项目画面格式无法读取。');const pattern=validatePattern(v.pattern),lights=validateLightShow(v.lights);lights.bpm=pattern.bpm;return {version:1,name:v.name.trim(),pattern,lights,tone:validateTone(v.tone||defaultTone),useTone:v.useTone===true,backdrop:v.backdrop||'',poster:v.poster||'',cycles:Number.isInteger(v.cycles)&&v.cycles>=1&&v.cycles<=16?v.cycles:4};}
export function parseProject(text){if(new TextEncoder().encode(text).length>2200000)throw new Error('项目文件不能超过2.2MB。');try{return validateProject(JSON.parse(text));}catch(error){throw new Error('无法载入演出项目：'+error.message);}}
export function projectPosition(elapsed,project){const absolute=Math.floor(Math.max(0,elapsed)/(60000/project.pattern.bpm/4));return {step:absolute%16,cycle:Math.floor(absolute/16)+1,done:absolute>=project.cycles*16,fraction:(Math.max(0,elapsed)/(60000/project.pattern.bpm/4))%1};}
