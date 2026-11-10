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
    { path: '/room', component: () => import('./views/RoomLayout.vue'), children: [
      { path: '', redirect: '/room/play' },
      { path: 'play', component: () => import('./components/room/PlayroomHome.vue') },
      { path: 'maze', component: () => import('./components/room/CardboardMaze.vue') },
      { path: 'effects', component: () => import('./components/room/GuitarEffects.vue') },
      { path: 'companion', component: () => import('./components/room/CompanionDesk.vue') },
      { path: 'echo', component: () => import('./components/room/MelodyEcho.vue') },
      { path: 'escape', component: () => import('./components/room/EscapeNight.vue') },
      { path: 'duet', component: () => import('./components/room/DuetChallenge.vue') },
      { path: 'photobooth', component: () => import('./components/room/PhotoBooth.vue') },
      { path: 'decorate', component: () => import('./components/room/RoomDecorator.vue') },
      { path: 'walk', component: () => import('./components/room/StrollMap.vue') },
      { path: 'search', component: () => import('./components/room/RehearsalSearch.vue') },
      { path: 'concert', component: () => import('./components/room/ConcertPlanner.vue') },
      { path: 'ambient', component: () => import('./components/room/AmbientMixer.vue') },
      { path: 'rhythm', component: () => import('./components/room/RhythmGame.vue') },
      { path: 'stories', component: () => import('./components/room/BranchingStories.vue') },
      { path: 'studio', component: () => import('./components/room/PatternStudio.vue') },
      { path: 'practice', component: () => import('./components/room/PracticeTimer.vue') },
      { path: 'notes', component: () => import('./components/room/JournalView.vue') },
      { path: 'notes/:slug', component: () => import('./components/room/JournalView.vue') },
      { path: 'guestbook', component: () => import('./components/room/GuestbookWall.vue') }
    ] },
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
