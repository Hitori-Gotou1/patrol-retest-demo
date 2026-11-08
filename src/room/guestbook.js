export const community = { repository: 'Hitori-Gotou1/patrol-retest-demo', pendingLabel: 'hitori-guestbook', approvedLabel: 'hitori-approved', path: 'public/community/guestbook.json' };
export const guestbookMarker = '<!-- hitori-guestbook:v1 -->';
function field(value, maximum, required = false) {
  if (typeof value !== 'string' || value.trim().length > maximum || (required && !value.trim())) throw new Error('请检查文字长度和必填内容。');
  return value.trim();
}
export function safeGuestbookLink(value) {
  if (!value) return '';
  try { const url = new URL(value); if (url.protocol === 'https:' && !url.username && !url.password && value.length <= 1000) return url.href; } catch { /* Display plain text only when no safe link is supplied. */ }
  throw new Error('推荐链接需要是有效的 HTTPS 地址，且不超过 1000 字符。');
}
export function validateGuestbookDraft(value) {
  if (!value || !['留言', '点歌'].includes(value.kind)) throw new Error('请选择留言或点歌。');
  return { kind: value.kind, nickname: field(value.nickname, 40), message: field(value.message, 600, true),
    song: field(value.song, 120, value.kind === '点歌'), link: safeGuestbookLink(field(value.link, 1000)) };
}
export function guestbookIssueBody(value) {
  const draft = validateGuestbookDraft(value);
  const escape = text => text.replace(/^(#{1,6}) /gm, '\\$1 ');
  return `${guestbookMarker}\n\n### 类别\n\n${draft.kind}\n\n### 昵称\n\n${escape(draft.nickname)}\n\n### 内容\n\n${escape(draft.message)}\n\n### 歌曲\n\n${escape(draft.song)}\n\n### 推荐链接\n\n${draft.link}\n\n### 提交说明\n\n我知道内容会公开在 GitHub，审核通过后才会在小屋展示。\n`;
}
export function guestbookSubmissionUrl(value) {
  const draft = validateGuestbookDraft(value);
  const url = new URL(`https://github.com/${community.repository}/issues/new`);
  url.searchParams.set('template', 'guestbook.md');
  url.searchParams.set('title', `[小屋来信] ${draft.kind} · ${draft.message.slice(0, 24)}`);
  url.searchParams.set('body', guestbookIssueBody(draft));
  if (url.href.length > 7500) throw new Error('内容或链接过长，请缩短后再继续。');
  return url.href;
}
export function draftFromIssue(issue) {
  if (!issue || issue.pull_request || !issue.title?.startsWith('[小屋来信]') || typeof issue.body !== 'string'
    || issue.body.length > 15000 || !issue.body.includes(guestbookMarker)) throw new Error('不是有效的小屋来信。');
  const fields = {}, names = { '类别': 'kind', '昵称': 'nickname', '内容': 'message', '歌曲': 'song', '推荐链接': 'link' };
  let current;
  for (const line of issue.body.split(/\r?\n/)) {
    const heading = /^### (.+)$/.exec(line);
    if (heading) { current = names[heading[1]]; if (current && fields[current] === undefined) fields[current] = ''; else current = undefined; }
    else if (current) fields[current] += line.replace(/^\\(#{1,6}) /, '$1 ') + '\n';
  }
  return validateGuestbookDraft(Object.fromEntries(Object.entries({ nickname: '', song: '', link: '', ...fields }).map(([key,value]) => [key,value.trim()])));
}
export function validateGuestbookWall(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.posts) || value.posts.length > 100) throw new Error('来信数据暂时无法读取。');
  const seen = new Set();
  const posts = value.posts.map(post => {
    if (!post || !Number.isSafeInteger(post.issue) || post.issue <= 0 || seen.has(post.issue)
      || typeof post.approvedBy !== 'string' || !post.approvedBy || post.approvedBy.length > 80
      || !Number.isFinite(Date.parse(post.approvedAt)) || !Number.isFinite(Date.parse(post.submittedAt))) throw new Error('来信数据格式不正确。');
    seen.add(post.issue);
    return { ...validateGuestbookDraft(post), issue: post.issue, approvedBy: post.approvedBy, approvedAt: post.approvedAt, submittedAt: post.submittedAt };
  });
  return { version: 1, updatedAt: typeof value.updatedAt === 'string' && Number.isFinite(Date.parse(value.updatedAt)) ? value.updatedAt : null, posts };
}
