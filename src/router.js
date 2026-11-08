import { createRouter, createWebHashHistory } from 'vue-router';
// 兼容迁移前分享过的 #gallery 等锚点，不额外产生一条历史记录。
const legacyScenes = new Set(['#home', '#about', '#theater', '#gallery', '#video']);
if (legacyScenes.has(location.hash)) {
  history.replaceState(history.state, '', `${location.pathname}${location.search}#/${location.hash}`);
}
export default createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', component: () => import('./views/HomeView.vue') },
    { path: '/manage-gallery', component: () => import('./views/GalleryAdminView.vue') },
    { path: '/about', component: () => import('./views/AboutView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ],
  scrollBehavior(to, from, savedPosition) {
    // Modal query changes keep the current page position; fresh links still
    // use their gallery anchor and ordinary scene navigation stays unchanged.
    if (from.matched.length && to.path === '/' && from.path === '/'
      && (to.query.image != null || from.query.image != null)
      && (to.hash === from.hash || (to.query.image != null && from.query.image == null && !from.hash && to.hash === '#gallery'))) return false;
    if (savedPosition) return savedPosition;
    if (to.hash) return { el: to.hash, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' };
    return { top: 0, behavior: 'instant' };
  }
});
