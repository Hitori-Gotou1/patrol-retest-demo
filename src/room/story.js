export function storyNode(story, path) {
  let id = story.start;
  if (!Array.isArray(path) || path.length > 30) throw new Error('剧情进度不正确');
  for (const index of path) {
    const choice = story.nodes[id]?.choices?.[index];
    if (!Number.isInteger(index) || !choice || !story.nodes[choice.next]) throw new Error('剧情进度不正确');
    id = choice.next;
  }
  return { id, ...story.nodes[id] };
}
export function storyEndings(story) { return Object.values(story.nodes).filter(node => node.ending).map(node => node.ending); }
export function validateStoryProgress(value, stories) {
  if (!value || value.version !== 1 || !value.progress || typeof value.progress !== 'object') throw new Error('剧情记录无法读取');
  const progress = {};
  for (const story of stories) {
    const saved = value.progress[story.id];
    let path = [];
    try { if (saved) { storyNode(story, saved.path); path = saved.path; } } catch { /* Keep valid unlocked endings even when a path became obsolete. */ }
    progress[story.id] = { path, endings: [...new Set((Array.isArray(saved?.endings) ? saved.endings : []).filter(ending => storyEndings(story).includes(ending)))] };
  }
  return { version: 1, progress, lastStory: stories.some(story => story.id === value.lastStory) ? value.lastStory : stories[0].id };
}
