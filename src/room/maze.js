import { mazeLevels } from '../data/adventures.js';
const point=(x,y)=>`${x},${y}`;
export const mazeDirections={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
export function mazeTiles(level){const data=mazeLevels[level];if(!data)throw new Error('无效的关卡');return data.rows.flatMap((row,y)=>[...row].map((tile,x)=>({x,y,tile})));}
export function newMaze(level=0){const tiles=mazeTiles(level),start=tiles.find(t=>t.tile==='S');return {level,x:start.x,y:start.y,boxes:tiles.filter(t=>t.tile==='B').map(({x,y})=>({x,y})),turn:0,steps:0,energy:100,hasKey:false,hidden:false,phase:'playing'};}
const tileAt=(level,x,y)=>mazeLevels[level]?.rows[y]?.[x]||'#';
const isBox=(state,x,y)=>state.boxes.some(b=>b.x===x&&b.y===y);
function blocked(state,x,y){const tile=tileAt(state.level,x,y);return tile==='#'||(tile==='D'&&!state.hasKey);}
export function mazeHazards(state){
  const level=mazeLevels[state.level],cells=new Set();
  for(const lamp of level.lights){
    const index=(Math.floor(state.turn/3)+lamp.phase)%4,[dx,dy]=[[1,0],[0,1],[-1,0],[0,-1]][index];
    cells.add(point(lamp.x,lamp.y));
    for(let distance=1;distance<=4;distance++){
      const x=lamp.x+dx*distance,y=lamp.y+dy*distance;
      if(blocked(state,x,y)||isBox(state,x,y))break;
      cells.add(point(x,y));
      if(distance>1)for(const sign of [-1,1]){const sx=x+dy*sign,sy=y+dx*sign;if(!blocked(state,sx,sy)&&!isBox(state,sx,sy))cells.add(point(sx,sy));}
    }
  }
  const crowds=level.crowds.map(path=>path[state.turn%path.length]);
  return {light:cells,crowds};
}
export function canHide(state){return state.boxes.some(b=>Math.abs(b.x-state.x)+Math.abs(b.y-state.y)<=1);}
export function moveMaze(input,action){
  if(input.phase!=='playing')return {state:input,message:'先整理好心情，再试一次吧。'};
  const state={...input,boxes:input.boxes.map(b=>({...b}))};let message='轻轻走了一步。';
  if(mazeDirections[action]){
    const [dx,dy]=mazeDirections[action],x=state.x+dx,y=state.y+dy;
    if(blocked(state,x,y))return {state:input,message:tileAt(state.level,x,y)==='D'?'门还锁着，先找钥匙。':'这里走不过去，换一条小路吧。'};
    const box=state.boxes.find(b=>b.x===x&&b.y===y);
    if(box){if(blocked(state,x+dx,y+dy)||isBox(state,x+dx,y+dy)||['K','E'].includes(tileAt(state.level,x+dx,y+dy)))return {state:input,message:'纸箱被挡住了，试试从另一侧推动。'};box.x+=dx;box.y+=dy;message='纸箱向前挪了一点，也挡住了一点灯光。';}
    state.x=x;state.y=y;state.hidden=false;state.steps++;
  }else if(action==='hide'){
    if(!state.hidden&&!canHide(state))return {state:input,message:'先走到纸箱旁边，才能躲进去。'};
    state.hidden=!state.hidden;message=state.hidden?'纸箱里暂时安全。等一拍，可以恢复社交电量。':'从纸箱里探出头，再试着向前一步。';
  }else if(action!=='wait')return {state:input,message:''};
  state.turn++;
  if(tileAt(state.level,state.x,state.y)==='K'&&!state.hasKey){state.hasKey=true;message='钥匙找到了！现在可以打开通往舞台的门。';}
  const hazards=mazeHazards(state),exposed=hazards.light.has(point(state.x,state.y))||hazards.crowds.some(c=>c.x===state.x&&c.y===state.y);
  state.energy=Math.max(0,Math.min(100,state.energy+(state.hidden?12:exposed?-22:0)));
  if(exposed&&!state.hidden)message='有点紧张，社交电量减少了。试着等一拍、绕开灯光，或去纸箱旁休息。';
  if(state.energy===0){state.phase='rest';message='先休息一下。你可以从本关起点再来，已解锁的关卡会保留。';}
  else if(tileAt(state.level,state.x,state.y)==='E'&&state.hasKey){state.phase='won';message='抵达舞台！这条路，是你自己走过来的。';}
  return {state,message};
}
export function validateMaze(v){
  if(!v||!Number.isInteger(v.level)||!mazeLevels[v.level])throw new Error('invalid maze');
  const base=newMaze(v.level),floor=(x,y)=>Number.isInteger(x)&&Number.isInteger(y)&&tileAt(v.level,x,y)!=='#';
  if(!floor(v.x,v.y)||!Array.isArray(v.boxes)||v.boxes.length!==base.boxes.length||!v.boxes.every(b=>floor(b.x,b.y))||new Set(v.boxes.map(b=>point(b.x,b.y))).size!==v.boxes.length||v.boxes.some(b=>b.x===v.x&&b.y===v.y))throw new Error('invalid position');
  const state={...base,x:v.x,y:v.y,boxes:v.boxes.map(({x,y})=>({x,y})),turn:Math.max(0,Math.min(100000,Math.floor(v.turn)||0)),steps:Math.max(0,Math.min(100000,Math.floor(v.steps)||0)),energy:Math.max(0,Math.min(100,Number(v.energy)||0)),hasKey:v.hasKey===true,hidden:v.hidden===true};
  state.phase=state.energy===0?'rest':tileAt(v.level,v.x,v.y)==='E'&&state.hasKey?'won':'playing';return state;
}
