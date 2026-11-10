import test from 'node:test';
import assert from 'node:assert/strict';
import {newCardBattle,playBandCard,endCardTurn,cardBasic,validateCardBattle,bandCardCost} from '../src/room/cardGame.js';
import {bandCards,mixChallenges,relaySeeds} from '../src/data/playground.js';
import {newJigsaw,swapJigsaw,rotateJigsaw,hintJigsaw,jigsawSolved,validateJigsaw} from '../src/room/jigsaw.js';
import {newShop,shopOrder,deliverOrder,buyDecoration,shopTimeout,validateShop} from '../src/room/shopGame.js';
import {newPlatform,stepPlatform,platformRects,validatePlatform} from '../src/room/platformGame.js';
import {newPinball,launchPinball,stepPinball,validatePinball} from '../src/room/pinballGame.js';
import {newComic,validateComic,wrapComicText,newLightShow,validateLightShow,lightFrame,newGraffiti,validateGraffiti,validateMix,mixScore} from '../src/room/creativeTools.js';
import {synthesizeStems,createMixEngine} from '../src/audio/mixEngine.js';
import {relayIssueBody,relayFromIssue,relaySubmissionUrl,validateRelayLedger,buildRelayWall,validateRelayWall,relayCommunity} from '../src/room/relayStory.js';
import {moderateRelay,moderateCommunity} from '../scripts/moderate-relay.mjs';

test('card campaigns are winnable across seeded decks, respect costs and preserve inputs',()=>{
 for(let seed=1;seed<=30;seed++){let hp=80;for(let stage=0;stage<3;stage++){let s=newCardBattle(seed,stage,hp),guard=0;while(s.phase==='playing'&&guard++<100){const before=JSON.stringify(s);let best=-1,value=-Infinity;s.hand.forEach((id,i)=>{const c=bandCards.find(c=>c.id===id);if(bandCardCost(c.id,s)>s.energy)return;const n=(c.power||0)+(c.draw||0)*5+(c.heal||0)*(s.hp<50?.6:.1)+(c.block||0)*.25-c.cost*2;if(n>value){best=i;value=n;}});const next=best>=0?playBandCard(s,best).state:s.energy&&!s.basic?cardBasic(s):endCardTurn(s);assert.equal(JSON.stringify(s),before);s=next;assert.ok(s.energy>=0);assert.ok(s.hand.length<=8);}assert.equal(s.phase,'won',`seed ${seed}, stage ${stage}`);hp=Math.min(100,s.hp+15);assert.deepEqual(validateCardBattle(s),s);}}
 let combo={...newCardBattle(7),hand:['rest','flyer','bass','unison']};for(const id of ['rest','flyer','bass'])combo=playBandCard(combo,combo.hand.indexOf(id)).state;assert.equal(bandCardCost('unison',combo),0);const progress=combo.progress;combo=playBandCard(combo,combo.hand.indexOf('unison')).state;assert.equal(combo.progress-progress,39);
 const s=newCardBattle(7);s.energy=0;assert.equal(playBandCard(s,s.hand.findIndex(id=>bandCards.find(c=>c.id===id).cost>0)).state,s);
 let lost={...newCardBattle(8),hp:1};lost=endCardTurn(lost);assert.equal(lost.phase,'lost');
});
test('all jigsaw sizes and rotations can be solved, hints terminate, corrupt permutations are rejected',()=>{
 for(const size of [3,4,5])for(const rotation of [false,true]){let s=newJigsaw(size,47,rotation);assert.equal(jigsawSolved(s),false);const original=JSON.stringify(s);assert.notEqual(swapJigsaw(s,0,1),s);assert.equal(JSON.stringify(s),original);if(rotation)assert.notDeepEqual(rotateJigsaw(s,0).rotations,s.rotations);for(let i=0;i<size*size&&!jigsawSolved(s);i++)s=hintJigsaw(s);assert.equal(jigsawSolved(s),true);assert.deepEqual(validateJigsaw(s),s);}
 assert.throws(()=>validateJigsaw({...newJigsaw(),tiles:Array(9).fill(0)}));
});
test('shop orders validate all requirements and coins buy persistent decorations without negative balances',()=>{
 let s={...newShop(17),phase:'serving'},o=shopOrder(s.seed+s.day*17,0);const bad=deliverOrder(s,{product:o.product,effect:o.effect,cents:7});assert.equal(bad.ok,false);assert.equal(s.mistakes,0);assert.equal(bad.state.coins,0);
 for(let i=0;i<3;i++){o=shopOrder(s.seed+s.day*17,s.index);s=deliverOrder(s,{...o,cents:0}).state;}assert.equal(s.phase,'closed');assert.equal(s.coins,225);s=buyDecoration(s,'plant');assert.equal(s.coins,75);assert.deepEqual(s.decorations,['plant']);assert.equal(buyDecoration(s,'plant'),s);assert.equal(buyDecoration(s,'lamp'),s);
 const timed={...newShop(3),phase:'serving',timed:true,elapsed:45};assert.equal(shopTimeout(timed).index,1);assert.equal(validateShop(timed).phase,'paused');
});
test('all three platform routes can be played to completion through simulation, with notes and checkpoint',()=>{
 for(let level=0;level<3;level++){let s={...newPlatform(level),phase:'playing'};for(let i=0;i<3000&&s.phase==='playing';i++){const p=platformRects(level,s.elapsed)[s.standing];s=stepPlatform(s,{right:true,charge:true,jump:s.grounded&&p&&s.x>p.x+p.w-45},1/120);}assert.equal(s.phase,'won');assert.ok(s.notes.length>=3);assert.equal(s.deaths,0);assert.equal(s.checkpoint,1000);assert.equal(validatePlatform(s).phase,'won');}
 let s={...newPlatform(),phase:'playing'};s=stepPlatform(s,{jump:true},.01);assert.equal(s.jumps,1);s=stepPlatform(s,{jump:true},.01);assert.equal(s.jumps,2);const vy=s.vy;s=stepPlatform(s,{jump:true},.01);assert.ok(s.vy>vy,'a third mid-air jump must not restart ascent');s=stepPlatform({...s,y:650,checkpoint:1000},{},.01);assert.equal(s.x,1000);assert.equal(s.deaths,1);assert.equal(validatePlatform({...s,phase:'playing'}).phase,'ready');
});
test('pinball collision scores once per contact window, flippers move, lives drain and extreme simulations stay finite',()=>{
 let launched=launchPinball(newPinball(),.5);for(let i=0;i<24;i++)launched=stepPinball(launched,{},1/120);assert.ok(launched.y<600,'the launch gate must let the ball into the board');
 let s={...newPinball(),phase:'playing',x:180,y:210,vx:0,vy:200};s=stepPinball(s,{},1/120);assert.ok(s.score>=100);assert.ok(s.events.includes('guitar'));const score=s.score;s=stepPinball(s,{},1/120);assert.equal(s.score,score);
 s=stepPinball({...s,y:895},{left:true,right:true},1/120);assert.equal(s.lives,2);assert.equal(s.phase,'waiting');assert.ok(s.leftAngle<.35);s=launchPinball(s,1);assert.equal(s.phase,'playing');assert.ok(s.vy<-1000);
 for(let i=0;i<20000;i++){if(['waiting','ready'].includes(s.phase))s=launchPinball(s,.8);if(s.phase==='over')s=launchPinball(newPinball(),.6);s=stepPinball(s,{left:i%120<60,right:i%80<40,nudge:i%360===0},1/120);assert.ok([s.x,s.y,s.vx,s.vy,s.score].every(Number.isFinite));assert.ok(Math.hypot(s.vx,s.vy)<=1250.001);}
 assert.equal(validatePinball({...s,phase:'playing'}).phase,'paused');assert.equal(stepPinball({...s,phase:'paused'},{},.1).phase,'paused');
});
test('creative schemas retain useful content, reject excessive input, and interpolate light cues',()=>{
 const light=newLightShow();assert.deepEqual(validateLightShow(light),light);light.cues[0][0].x=100;light.cues[0][1].x=300;assert.equal(lightFrame(light,0,.5)[0].x,200);light.cues[0][0].fade=false;assert.equal(lightFrame(light,0,.5)[0].x,100);assert.throws(()=>validateLightShow({...light,cues:[]}));
 const comic=validateComic(newComic());assert.equal(comic.panels.length,4);assert.equal(validateComic(comic).panels[0].objects[0].x,190);assert.ok(wrapComicText('好'.repeat(60)).every(line=>line.length<=19));assert.equal(validateComic({...comic,title:'x'.repeat(80)}).title.length,40);
 const drawing=newGraffiti();drawing.layers[1].strokes=[{tool:'pen',color:'#123456',size:9,stamp:'✦',points:[[.2,.3],[.4,.5]]}];assert.deepEqual(validateGraffiti(drawing),drawing);assert.throws(()=>validateGraffiti({...drawing,paper:'url(javascript:1)'}));assert.throws(()=>validateGraffiti({...drawing,layers:drawing.layers.map(l=>({...l,strokes:Array(120).fill(drawing.layers[1].strokes[0])}))}));
 for(const task of mixChallenges){assert.equal(mixScore(task,task.target),100);assert.ok(mixScore(task,task.initial)<85);}assert.equal(validateMix({version:1,channels:mixChallenges[0].target}).channels.length,4);
});
test('four original audio stems are deterministic, non-silent, distinct, bounded and faded',()=>{
 const stems=synthesizeStems(8000),again=synthesizeStems(8000);assert.equal(stems.length,4);for(let i=0;i<4;i++){assert.equal(stems[i].length,64000);assert.deepEqual(stems[i],again[i]);assert.ok(stems[i].some(s=>Math.abs(s)>.1));assert.ok(stems[i].every(s=>Number.isFinite(s)&&Math.abs(s)<1));assert.equal(stems[i][0],0);assert.ok(Math.abs(stems[i].at(-1))<.002);if(i)assert.notDeepEqual(stems[i],stems[0]);}
});
test('mix engine cancels late audio activation on route change',async()=>{
 let resolve,starts=0;const context={state:'suspended',sampleRate:10,createGain:()=>({gain:{value:0},connect(){},disconnect(){}}),createDynamicsCompressor:()=>({threshold:{},ratio:{},connect(){},disconnect(){}}),createBuffer:(_c,n)=>({copyToChannel(){}}),resume:async()=>{context.state='running';await new Promise(r=>resolve=r);},suspend:async()=>{context.state='suspended';},close:async()=>{context.state='closed';}};
 const engine=createMixEngine({createContext:()=>context}),promise=engine.play(mixChallenges[0].target);engine.stop();resolve();assert.equal(await promise,false);assert.equal(starts,0);assert.equal(context.state,'suspended');engine.dispose();
});
const repo={owner:'Hitori-Gotou1',repo:'patrol-retest-demo'},date=new Date('2026-11-10T10:00:00Z');
const draft=(chapter=1,parentIssue=0,line='下一句，会去哪里呢？')=>({storyId:relaySeeds[0].id,chapter,parentIssue,nickname:'访客',line});
const reviewed=(issue,chapter,parentIssue,line)=>({...draft(chapter,parentIssue,line),issue,approvedBy:repo.owner,approvedAt:date.toISOString()});
test('relay reveals only the last line until six, preserves a published branch and drops revoked descendants',()=>{
 let ledger={version:1,reviewed:[reviewed(10,1,0,'第一句')]},wall=buildRelayWall(ledger);assert.equal(wall.stories[0].lastLine,'第一句');assert.deepEqual(wall.stories[0].parts,[]);
 ledger.reviewed.push(reviewed(5,1,0,'另一条迟到的分支'));wall=buildRelayWall(ledger,wall);assert.equal(wall.stories[0].lastIssue,10);
 for(let c=2;c<=6;c++)ledger.reviewed.push(reviewed(10*c,c,10*(c-1),`第${c}句`));wall=buildRelayWall(ledger,wall);assert.equal(wall.stories[0].parts.length,6);assert.deepEqual(validateRelayWall(wall),wall);
 ledger.reviewed=ledger.reviewed.filter(p=>p.issue!==20);wall=buildRelayWall(ledger,wall);assert.equal(wall.stories[0].count,1);assert.deepEqual(wall.stories[0].parts,[]);
 assert.throws(()=>validateRelayLedger({version:1,reviewed:[ledger.reviewed[0],ledger.reviewed[0]]}));const issue={title:'[小屋接龙] test',body:relayIssueBody(draft())};assert.deepEqual(relayFromIssue(issue),draft());assert.equal(new URL(relaySubmissionUrl(draft())).searchParams.get('labels'),relayCommunity.pendingLabel);
});
function relayFixture(){const store=new Map([[relayCommunity.ledgerPath,{version:1,reviewed:[]}],[relayCommunity.path,buildRelayWall({version:1,reviewed:[]},{stories:[]},null)],['public/community/guestbook.json',{version:1,posts:[]}]]),shas=new Map([...store.keys()].map(k=>[k,0])),state={store,dispatches:0,removed:[],conflict:false,failDispatch:false,latest:null};const github={rest:{issues:{get:async()=>({data:structuredClone(state.latest)}),removeLabel:async({issue_number})=>state.removed.push(issue_number)},repos:{getCollaboratorPermissionLevel:async()=>({data:{permission:'read'}}),getContent:async({path})=>({data:{type:'file',sha:String(shas.get(path)),content:Buffer.from(JSON.stringify(store.get(path))).toString('base64')}}),createOrUpdateFileContents:async({path,sha,content})=>{if(state.conflict){state.conflict=false;shas.set(path,shas.get(path)+1);throw Object.assign(new Error('conflict'),{status:409});}assert.equal(sha,String(shas.get(path)));store.set(path,JSON.parse(Buffer.from(content,'base64').toString()));shas.set(path,shas.get(path)+1);}},actions:{createWorkflowDispatch:async()=>{if(state.failDispatch)throw new Error('dispatch failed');state.dispatches++;}}}};const event=(number,value=draft(),action='labeled',sender=repo.owner)=>{const issue={number,title:'[小屋接龙] test',body:relayIssueBody(value),state:'open',labels:[{name:relayCommunity.pendingLabel},{name:relayCommunity.approvedLabel}],updated_at:date.toISOString(),user:{login:'visitor'}};state.latest=issue;return {action,issue,label:{name:relayCommunity.approvedLabel},sender:{login:sender}};};return {state,github,event};}
test('relay moderation enforces authorization and current body, retries conflicts and publication, and withdraws markerless edits',async()=>{
 for(const invalid of ['actor','body','closed']){const {state,github,event}=relayFixture(),payload=event(1,draft(),'labeled',invalid==='actor'?'visitor':repo.owner);if(invalid==='body')state.latest={...state.latest,body:'unreviewed'};if(invalid==='closed')state.latest={...state.latest,state:'closed'};await moderateRelay(github,repo,payload,date);assert.equal(state.store.get(relayCommunity.ledgerPath).reviewed.length,0);assert.deepEqual(state.removed,[1]);}
 const {state,github,event}=relayFixture();state.conflict=true;await moderateCommunity(github,repo,event(1),date);assert.equal(state.store.get(relayCommunity.path).stories[0].count,1);
 state.failDispatch=true;await assert.rejects(moderateRelay(github,repo,event(2,draft(2,1)),date));assert.equal(state.store.get(relayCommunity.path).stories[0].count,2);state.failDispatch=false;await moderateRelay(github,repo,event(2,draft(2,1)),date);assert.equal(state.store.get(relayCommunity.ledgerPath).reviewed.length,2);
 const edited=event(1,draft(),'edited','visitor');edited.issue.title='all markers removed';edited.issue.body='';await moderateCommunity(github,repo,edited,date);assert.equal(state.store.get(relayCommunity.path).stories[0].count,0);assert.ok(state.removed.includes(1));
});
test('markerless relay withdrawals retry a failed deploy dispatch, unrelated edits do not deploy',async()=>{
 const {state,github,event}=relayFixture();await moderateCommunity(github,repo,event(1),date);const edited=event(1,draft(),'edited','visitor');edited.issue.title='[小屋来信] moved title';edited.issue.body='';state.failDispatch=true;await assert.rejects(moderateCommunity(github,repo,edited,date));assert.equal(state.store.get(relayCommunity.path).stories[0].count,0);state.failDispatch=false;const result=await moderateCommunity(github,repo,edited,date);assert.equal(result.publicationRetried,true);assert.equal(state.dispatches,2);
 const unknown=event(77,draft(),'edited','visitor');unknown.issue.title='unrelated';unknown.issue.body='';await moderateCommunity(github,repo,unknown,date);assert.equal(state.dispatches,2);
});
test('parallel relay approvals preserve both reviewed lines and both story snapshots through SHA conflicts',async()=>{
 const {state,github,event}=relayFixture(),a=event(10),b=event(20,{...draft(),storyId:relaySeeds[1].id}),issues=new Map([[10,a.issue],[20,b.issue]]),sha=new Map([...state.store.keys()].map(path=>[path,0]));
 github.rest.issues.get=async({issue_number})=>({data:structuredClone(issues.get(issue_number))});
 github.rest.repos.getContent=async({path})=>({data:{type:'file',sha:String(sha.get(path)),content:Buffer.from(JSON.stringify(state.store.get(path))).toString('base64')}});
 github.rest.repos.createOrUpdateFileContents=async args=>{if(args.sha!==String(sha.get(args.path)))throw Object.assign(new Error('conflicting writer'),{status:409});state.store.set(args.path,JSON.parse(Buffer.from(args.content,'base64').toString()));sha.set(args.path,sha.get(args.path)+1);};
 await Promise.all([moderateRelay(github,repo,a,date),moderateRelay(github,repo,b,date)]);assert.equal(state.store.get(relayCommunity.ledgerPath).reviewed.length,2);const wall=validateRelayWall(state.store.get(relayCommunity.path));assert.equal(wall.stories[0].lastIssue,10);assert.equal(wall.stories[1].lastIssue,20);assert.equal(state.dispatches,2);
});
