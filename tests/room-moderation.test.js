import test from 'node:test';
import assert from 'node:assert/strict';
import { moderateGuestbook, setupCommunity } from '../scripts/moderate-guestbook.mjs';
import { community, guestbookIssueBody } from '../src/room/guestbook.js';

const repo = { owner:'Hitori-Gotou1',repo:'patrol-retest-demo' };
const date = new Date('2026-11-08T12:00:00Z');
const baseDraft = {kind:'留言',nickname:'访客',message:'这是一封经过审核的来信。',song:'',link:''};
function issue(number=1) { return {number,title:'[小屋来信] 留言',body:guestbookIssueBody(baseDraft),state:'open',user:{login:'visitor'},created_at:date.toISOString(),updated_at:date.toISOString(),labels:[{name:community.pendingLabel},{name:community.approvedLabel}]}; }
function event(action='labeled', sender=repo.owner) { return {action,label:{name:community.approvedLabel},sender:{login:sender},issue:issue()}; }
function fixture() {
  const state = { wall:{version:1,updatedAt:null,posts:[]},sha:0,latest:issue(),writes:[],dispatches:0,removed:[],labels:new Set(),conflict:false,failDispatch:false };
  const github = {rest:{
    issues:{
      get:async()=>({data:structuredClone(state.latest)}),
      removeLabel:async({name})=>{state.removed.push(name);state.latest.labels=state.latest.labels.filter(label=>label.name!==name);},
      getLabel:async({name})=>{if(!state.labels.has(name)) throw Object.assign(new Error('missing'),{status:404});return{data:{name}};},
      createLabel:async({name})=>{state.labels.add(name);}
    },
    repos:{
      getCollaboratorPermissionLevel:async()=>({data:{permission:'read'}}),
      getContent:async()=>({data:{type:'file',sha:String(state.sha),content:Buffer.from(JSON.stringify(state.wall)).toString('base64')}}),
      createOrUpdateFileContents:async args=>{
        if(state.conflict){state.conflict=false;state.wall.posts.push({...baseDraft,issue:99,approvedBy:repo.owner,approvedAt:date.toISOString(),submittedAt:date.toISOString()});state.sha++;throw Object.assign(new Error('conflict'),{status:409});}
        assert.equal(args.sha,String(state.sha)); assert.equal(args.path,community.path); assert.equal(args.branch,'main');
        state.wall=JSON.parse(Buffer.from(args.content,'base64').toString());state.sha++;state.writes.push(args);
      }
    },
    actions:{createWorkflowDispatch:async args=>{assert.equal(args.workflow_id,'deploy.yml');assert.equal(args.ref,'main');if(state.failDispatch) throw Object.assign(new Error('temporary dispatch failure'),{status:503});state.dispatches++;}}
  }};
  return {state,github};
}

test('community setup creates only missing moderation labels and is idempotent', async()=>{
  const {state,github}=fixture();await setupCommunity(github,repo);await setupCommunity(github,repo);
  assert.deepEqual([...state.labels].sort(),[community.pendingLabel,community.approvedLabel].sort());
});
test('an authorized review publishes a validated immutable snapshot and dispatches the gated Pages workflow',async()=>{
  const {state,github}=fixture();const result=await moderateGuestbook(github,repo,event(),date);
  assert.equal(result.published,true);assert.equal(state.wall.posts.length,1);assert.equal(state.wall.posts[0].message,baseDraft.message);
  assert.equal(state.wall.posts[0].approvedBy,repo.owner);assert.equal(state.dispatches,1);
  state.latest.body='unreviewed edit';
  assert.equal(state.wall.posts[0].message,baseDraft.message,'later issue edits cannot change the published snapshot');
});
test('self-labeling, stale approval payloads, and closed issues cannot publish unreviewed text',async()=>{
  for(const change of ['read-only-actor','body-changed','closed']){
    const {state,github}=fixture();const payload=event('labeled',change==='read-only-actor'?'visitor':repo.owner);
    if(change==='body-changed')state.latest.body+=' edited';if(change==='closed')state.latest.state='closed';
    await moderateGuestbook(github,repo,payload,date);
    assert.equal(state.wall.posts.length,0);assert.equal(state.writes.length,0);assert.ok(state.removed.includes(community.approvedLabel));
  }
});
test('pending submissions never trigger publication; trusted triage reviewers may approve',async()=>{
  const {state,github}=fixture();const pending=event();pending.label.name=community.pendingLabel;
  await moderateGuestbook(github,repo,pending,date);assert.equal(state.writes.length,0);
  github.rest.repos.getCollaboratorPermissionLevel=async()=>({data:{permission:'read',role_name:'triage'}});
  await moderateGuestbook(github,repo,event('labeled','moderator'),date);assert.equal(state.wall.posts[0].approvedBy,'moderator');
});
test('edits, closure, reopening, deletion and approval removal withdraw snapshots even after all markers disappear',async()=>{
  for(const action of ['edited','closed','reopened','deleted','unlabeled']){
    const {state,github}=fixture();await moderateGuestbook(github,repo,event(),date);
    const payload=event(action,'visitor');payload.issue.body='';payload.issue.title='changed';payload.issue.labels=[];
    await moderateGuestbook(github,repo,payload,new Date(date.getTime()+1000));
    assert.equal(state.wall.posts.length,0);assert.equal(state.dispatches,2);
  }
});
test('optimistic content updates retry conflicts without overwriting another approved message',async()=>{
  const {state,github}=fixture();state.conflict=true;
  await moderateGuestbook(github,repo,event(),date);
  assert.deepEqual(new Set(state.wall.posts.map(post=>post.issue)),new Set([1,99]));assert.equal(state.writes.length,1);
});
test('publication can be retried after a successful data commit without another content commit',async()=>{
  const {state,github}=fixture();state.failDispatch=true;
  await assert.rejects(moderateGuestbook(github,repo,event(),date));assert.equal(state.writes.length,1);
  state.failDispatch=false;const result=await moderateGuestbook(github,repo,event(),date);
  assert.equal(result.publicationRetried,true);assert.equal(state.writes.length,1);assert.equal(state.dispatches,1);
});
test('withdrawal dispatch can also be retried safely',async()=>{
  const {state,github}=fixture();await moderateGuestbook(github,repo,event(),date);
  state.failDispatch=true;const payload=event('closed','visitor');
  await assert.rejects(moderateGuestbook(github,repo,payload,date));assert.equal(state.wall.posts.length,0);
  state.failDispatch=false;await moderateGuestbook(github,repo,payload,date);assert.equal(state.writes.length,2);assert.equal(state.dispatches,2);
});
