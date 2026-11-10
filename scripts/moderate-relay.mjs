import {relayCommunity,relayFromIssue,validateRelayLedger,validateRelayWall,buildRelayWall,relayMarker} from '../src/room/relayStory.js';
import {moderateGuestbook} from './moderate-guestbook.mjs';
import {community} from '../src/room/guestbook.js';
import {createHash} from 'node:crypto';
const relayEventHash=payload=>createHash('sha256').update(JSON.stringify({issue:payload.issue.number,action:payload.action,label:payload.label?.name,body:payload.issue.body,title:payload.issue.title,updated:payload.issue.updated_at,sender:payload.sender?.login})).digest('hex');
const guestbookEventHash=payload=>createHash('sha256').update(JSON.stringify({issue:payload.issue.number,action:payload.action,label:payload.label?.name,updated:payload.issue.updated_at,body:payload.issue.body,sender:payload.sender?.login})).digest('hex');
async function read(github,repo,path){const response=await github.rest.repos.getContent({...repo,path,ref:'main'});if(response.data.type!=='file')throw new Error('接龙路径不是文件');return {sha:response.data.sha,value:JSON.parse(Buffer.from(response.data.content,'base64').toString('utf8'))};}
async function write(github,repo,path,sha,value,message){await github.rest.repos.createOrUpdateFileContents({...repo,branch:'main',path,sha,message,content:Buffer.from(JSON.stringify(value,null,2)+'\n').toString('base64')});}
export async function moderateRelay(github,repo,payload,now=new Date()){
  const issue=payload.issue;if(!issue||issue.pull_request||!Number.isSafeInteger(issue.number)||issue.number<=0)return {changed:false};
  const withdraw=['edited','closed','reopened','deleted'].includes(payload.action)||(payload.action==='unlabeled'&&[relayCommunity.pendingLabel,relayCommunity.approvedLabel].includes(payload.label?.name));
  const approve=payload.action==='labeled'&&payload.label?.name===relayCommunity.approvedLabel;if(!withdraw&&!approve)return {changed:false};
  const remove=async()=>{try{await github.rest.issues.removeLabel({...repo,issue_number:issue.number,name:relayCommunity.approvedLabel});}catch(e){if(e.status!==404)throw e;}};
  let post;
  if(withdraw)await remove();else{
    const actor=payload.sender?.login;let authorized=typeof actor==='string'&&actor.toLowerCase()===repo.owner.toLowerCase();
    if(!authorized&&actor){try{const {data}=await github.rest.repos.getCollaboratorPermissionLevel({...repo,username:actor});authorized=['admin','maintain','write','triage'].some(role=>role===data.permission||role===data.role_name);}catch(e){if(e.status!==404)throw e;}}
    const latest=(await github.rest.issues.get({...repo,issue_number:issue.number})).data,labels=(latest.labels||[]).map(l=>typeof l==='string'?l:l.name);
    if(!authorized||latest.state!=='open'||!labels.includes(relayCommunity.pendingLabel)||!labels.includes(relayCommunity.approvedLabel)||latest.body!==issue.body||latest.title!==issue.title)await remove();
    else{try{post={...relayFromIssue(issue),nickname:relayFromIssue(issue).nickname||issue.user?.login||'路过小屋的人',issue:issue.number,approvedBy:actor,approvedAt:issue.updated_at||now.toISOString()};validateRelayLedger({version:1,reviewed:[post]});}catch(error){await remove();throw error;}}
  }
  const eventHash=relayEventHash(payload);
  let changed=false,retryPublication=false;
  for(let attempt=0;attempt<4;attempt++){
    const current=await read(github,repo,relayCommunity.ledgerPath),ledger=validateRelayLedger(current.value),reviewed=ledger.reviewed.filter(p=>p.issue!==issue.number);if(post)reviewed.push(post);reviewed.sort((a,b)=>a.issue-b.issue);if(reviewed.length>300)throw new Error('接龙审核记录已满，请归档后继续。');
    if(current.value.lastEvent===eventHash)retryPublication=true;
    if(JSON.stringify(ledger.reviewed)!==JSON.stringify(reviewed)){try{await write(github,repo,relayCommunity.ledgerPath,current.sha,{version:1,reviewed,lastEvent:eventHash},`${post?'Review':'Withdraw'} relay line #${issue.number}`);changed=true;}catch(e){if(e.status===409&&attempt<3)continue;throw e;}}
    break;
  }
  // Each issue writes the reviewed ledger before the public snapshot, using SHA retries.
  // A retry rebuilds the snapshot from that ledger if publication was interrupted.
  for(let attempt=0;attempt<4;attempt++){
    // Read the snapshot first so an older ledger can never overwrite a newer snapshot.
    const current=await read(github,repo,relayCommunity.path),archive=await read(github,repo,relayCommunity.ledgerPath),previous=validateRelayWall(current.value),next=buildRelayWall(archive.value,previous,now.toISOString());
    if(current.value.lastEvent===eventHash)retryPublication=true;
    if(JSON.stringify(previous.stories)!==JSON.stringify(next.stories)){try{await write(github,repo,relayCommunity.path,current.sha,{...next,lastEvent:eventHash},`Update reviewed relay story #${issue.number}`);changed=true;}catch(e){if(e.status===409&&attempt<3)continue;throw e;}}
    break;
  }
  // GITHUB_TOKEN commits require an explicit Pages workflow dispatch, including retries.
  if(changed||retryPublication)await github.rest.actions.createWorkflowDispatch({...repo,workflow_id:'deploy.yml',ref:'main'});
  return {changed,published:Boolean(post),publicationRetried:retryPublication&&!changed};
}
export async function moderateCommunity(github,repo,payload,now){const issue=payload.issue;if(!issue||issue.pull_request)return {changed:false};if(['edited','closed','reopened','deleted','unlabeled'].includes(payload.action)){const archive=(await read(github,repo,relayCommunity.ledgerPath)).value,ledger=validateRelayLedger(archive);if(archive.lastEvent===relayEventHash(payload)||ledger.reviewed.some(p=>p.issue===issue.number))return moderateRelay(github,repo,payload,now);const snapshot=(await read(github,repo,relayCommunity.path)).value;if(snapshot.lastEvent===relayEventHash(payload)||snapshot.stories?.some(s=>s.accepted?.includes(issue.number)))return moderateRelay(github,repo,payload,now);const wall=(await read(github,repo,community.path)).value;if(wall.lastEvent===guestbookEventHash(payload)||wall.posts?.some(p=>p.issue===issue.number))return moderateGuestbook(github,repo,payload,now);}if(issue.body?.includes(relayMarker)||issue.title?.startsWith('[小屋接龙]'))return moderateRelay(github,repo,payload,now);if(issue.title?.startsWith('[小屋来信]'))return moderateGuestbook(github,repo,payload,now);return {changed:false};}
