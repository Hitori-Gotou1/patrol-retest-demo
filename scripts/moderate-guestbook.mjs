import { community, draftFromIssue, validateGuestbookWall } from '../src/room/guestbook.js';
import { createHash } from 'node:crypto';

export async function setupCommunity(github, repo) {
  for (const [name, color, description] of [[community.pendingLabel, 'd8b9cc', '小屋来信与点歌，等待站主审核'], [community.approvedLabel, '7f9e89', '站主已审核，可发布到小屋']]) {
    try { await github.rest.issues.getLabel({ ...repo, name }); }
    catch (error) { if (error.status !== 404) throw error; await github.rest.issues.createLabel({ ...repo, name, color, description }); }
  }
}

async function removeApproval(github, repo, number) {
  try { await github.rest.issues.removeLabel({ ...repo, issue_number: number, name: community.approvedLabel }); }
  catch (error) { if (error.status !== 404) throw error; }
}

export async function moderateGuestbook(github, repo, payload, now = new Date()) {
  const issue = payload.issue;
  if (!issue || issue.pull_request || !Number.isSafeInteger(issue.number) || issue.number <= 0) return { changed: false };
  const number = issue.number;
  const withdraw = ['edited', 'closed', 'reopened', 'deleted'].includes(payload.action)
    || (payload.action === 'unlabeled' && [community.approvedLabel, community.pendingLabel].includes(payload.label?.name));
  const approve = payload.action === 'labeled' && payload.label?.name === community.approvedLabel;
  if (!withdraw && !approve) return { changed: false };
  let post;
  if (withdraw) await removeApproval(github, repo, number);
  else {
    const actor = payload.sender?.login;
    let authorized = typeof actor === 'string' && actor.toLowerCase() === repo.owner.toLowerCase();
    if (!authorized && actor) {
      try {
        const permission = await github.rest.repos.getCollaboratorPermissionLevel({ ...repo, username: actor });
        authorized = ['admin', 'maintain', 'write', 'triage'].some(role => role === permission.data.permission || role === permission.data.role_name);
      } catch (error) { if (error.status !== 404) throw error; }
    }
    const latest = (await github.rest.issues.get({ ...repo, issue_number: number })).data;
    const currentLabels = (latest.labels || []).map(label => typeof label === 'string' ? label : label.name);
    if (!authorized || latest.state !== 'open' || !currentLabels.includes(community.approvedLabel) || !currentLabels.includes(community.pendingLabel)
      || latest.body !== issue.body || latest.title !== issue.title) {
      await removeApproval(github, repo, number);
    } else {
      try {
        const draft = draftFromIssue(issue);
        post = { ...draft, nickname: draft.nickname || issue.user?.login || '路过小屋的人', issue: number,
          approvedBy: actor, approvedAt: issue.updated_at || now.toISOString(), submittedAt: issue.created_at };
        validateGuestbookWall({ version: 1, posts: [post], updatedAt: null });
      } catch (error) { await removeApproval(github, repo, number); throw error; }
    }
  }
  const eventHash = createHash('sha256').update(JSON.stringify({ issue: number, action: payload.action, label: payload.label?.name,
    updated: issue.updated_at, body: issue.body, sender: payload.sender?.login })).digest('hex');
  const dispatch = () => github.rest.actions.createWorkflowDispatch({ ...repo, workflow_id: 'deploy.yml', ref: 'main' });
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await github.rest.repos.getContent({ ...repo, path: community.path, ref: 'main' });
    if (Array.isArray(response.data) || response.data.type !== 'file') throw new Error('来信快照路径不是文件');
    const raw = JSON.parse(Buffer.from(response.data.content, 'base64').toString('utf8'));
    const existing = validateGuestbookWall(raw);
    const posts = existing.posts.filter(entry => entry.issue !== number);
    if (post) posts.push(post);
    posts.sort((a, b) => b.approvedAt.localeCompare(a.approvedAt) || b.issue - a.issue);
    const next = { version: 1, updatedAt: now.toISOString(), posts: posts.slice(0, 100), lastEvent: eventHash };
    if (JSON.stringify(existing.posts) === JSON.stringify(next.posts)) {
      if (raw.lastEvent === eventHash) { await dispatch(); return { changed: false, publicationRetried: true }; }
      return { changed: false };
    }
    try {
      await github.rest.repos.createOrUpdateFileContents({ ...repo, branch: 'main', path: community.path, sha: response.data.sha,
        message: `${post ? 'Publish reviewed' : 'Withdraw'} guestbook entry #${number}`,
        content: Buffer.from(JSON.stringify(next, null, 2) + '\n').toString('base64') });
    } catch (error) { if (error.status === 409 && attempt < 3) continue; throw error; }
    // Commits made by GITHUB_TOKEN do not trigger the usual push workflow.
    // An explicit dispatch publishes this reviewed snapshot through all gates.
    await dispatch();
    return { changed: true, published: Boolean(post) };
  }
}
