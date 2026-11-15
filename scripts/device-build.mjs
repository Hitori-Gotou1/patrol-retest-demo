import { createHash } from 'node:crypto';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
const choices = {
  photobooth: { title: '拍贴合影', component: 'PhotoBooth.vue', portraits: true },
  decorate: { title: '房间布置', component: 'RoomDecorator.vue', portraits: true },
  comic: { title: '四格漫画', component: 'ComicWorkshop.vue', portraits: true },
  graffiti: { title: '演出涂鸦', component: 'GraffitiWall.vue', portraits: true },
  lights: { title: '灯光编舞', component: 'LightChoreography.vue', portraits: true },
  studio: { title: '自己的编曲', component: 'PatternStudio.vue' },
  practice: { title: '练琴日志', component: 'PracticeTimer.vue' },
  rhythm: { title: '节奏练习', component: 'RhythmGame.vue' },
  stories: { title: '分支小剧场', component: 'BranchingStories.vue' },
  walk: { title: '散步集章', component: 'StrollMap.vue', portraits: true }
};
export function deviceBuildPlugin({ base = '/patrol-retest-demo/' } = {}) {
  let root;
  return {
    name: 'hitori-device-offline', apply: 'build', enforce: 'post',
    configResolved(config) { root = config.root; },
    generateBundle(_options, bundle) {
      const entry = Object.values(bundle).find(file => file.type === 'chunk' && file.isEntry);
      const chunks = Object.values(bundle).filter(file => file.type === 'chunk');
      const workerTemplate = readFileSync(path.join(root, 'scripts/offline-worker.js'), 'utf8');
      const find = suffix => chunks.find(chunk => chunk.facadeModuleId?.endsWith(suffix) || chunk.moduleIds?.some(id => id.endsWith(suffix)));
      const closure = roots => {
        const files = new Set(), visit = name => {
          if (!name || files.has(name)) return; files.add(name);
          const chunk = bundle[name];
          if (chunk?.type === 'chunk') {
            for (const dependency of chunk.imports) visit(dependency);
            for (const css of chunk.viteMetadata?.importedCss || []) files.add(css);
            for (const asset of chunk.viteMetadata?.importedAssets || []) files.add(asset);
          }
        };
        roots.forEach(chunk => visit(typeof chunk === 'string' ? chunk : chunk?.fileName)); return [...files];
      };
      const thumbs = ['hitori','nijika','ryo','kita'].map(name => `assets/characters/${name}-thumbnail.webp`);
      const portraits = ['hitori','nijika','ryo','kita'].flatMap(name => [`assets/characters/${name}-artwork.webp`,`assets/characters/${name}-portrait.webp`]);
      const optionalCompanion = find('/src/components/RoomCompanion.vue');
      const core = [...new Set(['index.html', 'offline.html', 'manifest.webmanifest', 'icons/hitori-192.png', 'icons/hitori-512.png',
        ...thumbs, ...closure([entry, find('/src/views/RoomLayout.vue'), find('/src/components/room/PlayroomHome.vue'), find('/src/views/DeviceSettingsView.vue'), find('/src/components/tools/DraftConflictNotice.vue'), find('/src/services/siteSearch.js'), find('/src/services/galleryCloud.js'), optionalCompanion]),
        'assets/activities/photobooth.webp','assets/activities/comic.webp','assets/activities/ambient.webp'])];
      const sizeOf = file => {
        const item = bundle[file];
        if (item?.type === 'chunk') return Buffer.byteLength(item.code);
        if (item?.type === 'asset') return Buffer.byteLength(item.source);
        const disk = path.join(root, 'public', file); return existsSync(disk) ? statSync(disk).size : 0;
      };
      const groups = Object.fromEntries(Object.entries(choices).map(([id, choice]) => {
        const files = [...new Set([...closure([find(`/src/components/room/${choice.component}`)]), ...(choice.portraits ? portraits : [])])];
        return [id, { title: choice.title, path: `/room/${id}`, files, bytes: files.reduce((sum, file) => sum + sizeOf(file), 0) }];
      }));
      const fingerprint = createHash('sha256').update(process.env.GITHUB_SHA || 'local')
        .update(chunks.map(chunk => chunk.code).join('')).update(workerTemplate)
        .update(readFileSync(new URL(import.meta.url))).update(JSON.stringify({ base, core, groups }));
      const htmlPath = path.join(root, 'index.html'); if (existsSync(htmlPath)) fingerprint.update(readFileSync(htmlPath));
      // Fingerprint only the allowed resource set, including fixed-URL artwork/icons.
      for (const file of [...new Set([...core, ...Object.values(groups).flatMap(group => group.files)])].sort()) {
        fingerprint.update(file);
        const item = bundle[file], disk = path.join(root, 'public', file);
        if (item?.type === 'asset') fingerprint.update(item.source);
        else if (existsSync(disk)) fingerprint.update(readFileSync(disk));
      }
      const version = fingerprint.digest('hex').slice(0, 16);
      const manifest = { version, base, entry: entry?.fileName, core, coreBytes: core.reduce((sum, file) => sum + sizeOf(file), 0), groups };
      this.emitFile({ type: 'asset', fileName: 'offline-manifest.json', source: JSON.stringify(manifest) });
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: JSON.stringify({ id: base, name: '一里小屋 · HITORI ROOM', short_name: '一里小屋',
        lang: 'zh-CN', start_url: `${base}#/room/play`, scope: base, display: 'standalone', background_color: '#28202e', theme_color: '#28202e',
        description: '放学以后，小屋还亮着灯。选择常用玩法，离线也能继续创作。',
        icons: [{ src: 'icons/hitori-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icons/hitori-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }] }) });
      this.emitFile({ type: 'asset', fileName: 'offline.html', source: '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#28202e"><title>离线的小屋</title><style>body{background:#28202e;color:#f2dbbf;font:18px/1.9 system-ui;max-width:36rem;padding:10vh 24px;margin:auto}a{color:#edb4cc;display:inline-block;padding:14px 0}</style><h1>小屋暂时离线了。</h1><p>已经保存的作品和草稿仍在本机。联网后，去「设备与同步」选择常用玩法，下次就能离线继续。</p><a href="./?from=offline#/settings/device">回到设备与同步 →</a><p><button onclick="location.reload()">恢复网络后重试</button></p></html>' });
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: workerTemplate.replace('__HITORI_MANIFEST__', JSON.stringify(manifest)) });
    },
    transformIndexHtml() {
      return [{ tag: 'link', attrs: { rel: 'manifest', href: `${base}manifest.webmanifest` }, injectTo: 'head' },
        { tag: 'link', attrs: { rel: 'apple-touch-icon', href: `${base}icons/hitori-192.png` }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'theme-color', content: '#28202e' }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'apple-mobile-web-app-capable', content: 'yes' }, injectTo: 'head' }];
    }
  };
}
