// Small bounded worker pool. Cancellation never pretends to roll back a published upload.
export function createGalleryUploadQueue({ concurrency = 2, publish, changed = () => {}, tasks = [] }) {
  let running = 0;
  let paused = true;
  async function run(task) {
    running++;
    task.status = 'uploading'; task.progress = '正在准备…'; changed();
    try {
      task.result = await publish(task, progress => { task.progress = progress; changed(); });
      task.status = 'done'; task.progress = '已发布'; task.error = '';
    } catch (error) { task.status = 'failed'; task.error = error?.message || '发布失败，请重试。'; }
    finally { running--; changed(); pump(); }
  }
  function pump() {
    if (paused) return;
    while (running < Math.max(1, Math.min(2, concurrency))) {
      const task = tasks.find(item => item.status === 'queued');
      if (!task) break;
      run(task);
    }
  }
  return {
    tasks,
    add(task) { tasks.push({ ...task, status: task.status || 'queued', error: task.error || '', progress: '' }); changed(); pump(); },
    start() { paused = false; pump(); },
    pause() { paused = true; changed(); },
    cancel(id) { const task = tasks.find(item => item.id === id); if (task && ['queued', 'failed'].includes(task.status)) { task.status = 'cancelled'; changed(); } },
    retry(id) { const task = tasks.find(item => item.id === id); if (task?.status === 'failed') { task.status = 'queued'; task.error = ''; changed(); pump(); } },
    get active() { return running > 0 || (!paused && tasks.some(item => item.status === 'queued')); },
    get paused() { return paused; }
  };
}
