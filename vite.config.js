import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import { validateGalleryConfig } from './src/services/galleryCloudConfig.js';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_SUPABASE_');
  // 在 Vite 注入变量前检查，防止误填服务端密钥后生成公开产物。
  validateGalleryConfig(env.VITE_SUPABASE_URL || '', env.VITE_SUPABASE_PUBLISHABLE_KEY || '');
  return { plugins: [vue()], base: '/patrol-retest-demo/' };
});
