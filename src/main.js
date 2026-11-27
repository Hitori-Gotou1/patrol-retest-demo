import { createApp } from 'vue';
import {countEvent} from './services/analytics.js';
import {applyPreferences} from './room/preferences.js';
import './styles/expansion.css';
import App from './App.vue';
import router from './router.js';
import { startDeviceServices } from './services/deviceServices.js';
import { connectRouterRecovery } from './services/appRecovery.js';
import './styles/styles.css';
import './styles/bocchi.css';
import './styles/characters.css';
import './styles/scenes.css';
import './styles/enhancements.css';
import './styles/mobile-workspace.css';
import './styles/visual-upgrade.css';
import './styles/room-materials.css';

// 初始路由与异步页面就绪后再挂载，导航才可读取完整的五幕节点。
applyPreferences();
window.addEventListener('storage',applyPreferences);
const app = createApp(App);
connectRouterRecovery(router);
app.use(router);
window.addEventListener('hitori:export',event=>countEvent('export',event.detail));
router.afterEach(to=>{if(to.path==='/')countEvent('open',to.hash==='#gallery'?'gallery':'home');});
router.isReady().then(() => { app.mount('#app'); void startDeviceServices(); }).catch(error => {
  console.error('[一里小屋] 启动失败', error);
  document.getElementById('boot-status')?.setAttribute('data-state','error');
  document.getElementById('boot-message').textContent = '小屋暂时没有打开。请检查网络后重试，或刷新网站版本。你的作品和草稿会保留。';
  document.getElementById('boot-retry').hidden = false;
});
