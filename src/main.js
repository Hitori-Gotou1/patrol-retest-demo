import { createApp } from 'vue';
import App from './App.vue';
import router from './router.js';
import './styles/styles.css';
import './styles/bocchi.css';
import './styles/characters.css';
import './styles/scenes.css';
import './styles/enhancements.css';

// 初始路由与异步页面就绪后再挂载，导航才可读取完整的五幕节点。
const app = createApp(App);
app.use(router);
router.isReady().then(() => app.mount('#app'));
