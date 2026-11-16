/** Wait for preceding lazy chapters before measuring a deep-link target.
 * This runs only for real anchor navigation, never for lightbox query changes. */
export function settledSceneAnchor(hash) {
  const ids = ['home', 'about', 'theater', 'gallery', 'video'];
  const target = hash.replace(/^#/, ''), index = ids.indexOf(target);
  if (index < 0) return Promise.resolve();
  return new Promise(resolve => {
    let timer, frame, done = false;
    function finish() {
      if (done) return;
      done = true; clearTimeout(timer);
      window.removeEventListener('hitori:scene-ready', check);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => resolve());
    }
    function check() {
      if (ids.slice(0, index + 1).every(id => {
        const node = document.getElementById(id);
        return node && !node.classList.contains('scene-pending');
      })) finish();
    }
    window.addEventListener('hitori:scene-ready', check);
    timer = setTimeout(finish, 3000);
    check();
  });
}
