import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import { validateGalleryConfig } from './src/services/galleryCloudConfig.js';
const base = '/patrol-retest-demo/';
const commit = process.env.GITHUB_SHA || 'local';

// A cached tab and the current deployment can otherwise look identical.
const buildInfo = {
  name: 'hitori-build-info',
  apply: 'build',
  transformIndexHtml() {
    return [{ tag: 'meta', attrs: { name: 'hitori-build', content: commit }, injectTo: 'head' }];
  },
  generateBundle(_options, bundle) {
    const entry = Object.values(bundle).find(file => file.type === 'chunk' && file.isEntry);
    this.emitFile({
      type: 'asset', fileName: 'build-info.json',
      source: JSON.stringify({ commit, base, entry: entry.fileName }, null, 2) + '\n'
    });
  }
};
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_SUPABASE_');
  // 在 Vite 注入变量前检查，防止误填服务端密钥后生成公开产物。
  validateGalleryConfig(env.VITE_SUPABASE_URL || '', env.VITE_SUPABASE_PUBLISHABLE_KEY || '');
  return { plugins: [vue(), buildInfo], base };
});
