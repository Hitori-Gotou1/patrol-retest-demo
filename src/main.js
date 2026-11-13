import { createApp } from 'vue';
import {countEvent} from './services/analytics.js';
import {applyPreferences} from './room/preferences.js';
import './styles/expansion.css';
import App from './App.vue';
import router from './router.js';
import './styles/styles.css';
import './styles/bocchi.css';
import './styles/characters.css';
import './styles/scenes.css';
import './styles/enhancements.css';

// 初始路由与异步页面就绪后再挂载，导航才可读取完整的五幕节点。
applyPreferences();
window.addEventListener('storage',applyPreferences);
const app = createApp(App);
app.use(router);
window.addEventListener('hitori:export',event=>countEvent('export',event.detail));
router.afterEach(to=>{if(to.path==='/')countEvent('open',to.hash==='#gallery'?'gallery':'home');});
router.isReady().then(() => app.mount('#app'));
