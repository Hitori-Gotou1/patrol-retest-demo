# 管理页路由与发布版本排查

管理入口：`https://hitori-gotou1.github.io/patrol-retest-demo/#/manage-gallery`。

## 本次发现

- `src/router.js` 使用 `createWebHashHistory(import.meta.env.BASE_URL)`；Vite base 为 `/patrol-retest-demo/`。子目录放在 `#` 前，路由路径 `/manage-gallery` 放在 `#` 后，这套配置正确。
- `/manage-gallery` 已注册，异步加载 `GalleryAdminView.vue`。未登录时由管理页显示登录表单；没有把未登录访客送回首页的导航守卫。管理页唯一的离开守卫用于保护正在进行的上传。
- 旧提交 `2b99987` 没有管理路由，其 `/:pathMatch(.*)*` 兜底会重定向到 `/`，准确解释“hash 短暂变化后恢复 `#/`，且没有红色错误”。GSAP 的空目标警告不能造成这次路由重定向。
- 最新已发布提交为 `808908fffec0be6d35f5ab04e978c2c1274b2625`，来自 PR #3。Actions run `41187740542` 的构建、上传和部署均成功，归档日志包含管理页 JS/CSS，公开的 Supabase 构建变量已传入。
- 只读线上检查在普通请求和随机查询参数请求中均读到 `assets/index-DdvXLsg9.js`，包含 `/manage-gallery` 和 `GalleryAdminView`。HTML `Last-Modified` 为 `2026-10-31 09:12:58 GMT`，`Cache-Control: max-age=600`。当前 CDN 返回的新包一致；已经打开的标签页仍可能持有旧路由表，修改 hash 不会重新下载入口 JS。

因此，现有证据指向旧 HTML 缓存或未刷新标签页中的旧 JS；无法从远端读取原故障浏览器的内存和缓存，因此不把这两者进一步强行区分。无需更改正确的 Hash History、Supabase SQL、授权或数据。

## 恢复旧标签页

完整重新加载页面，或使用一次性版本查询参数打开新入口：

`https://hitori-gotou1.github.io/patrol-retest-demo/?build=808908f#/manage-gallery`

仅设置 `location.hash` 是同文档导航，旧路由表会继续生效。若仍异常，开发者工具中启用 Disable cache 后重新加载；核对 Network 中 HTML 引用的入口 JS 是否为上述版本。仓库没有注册 Service Worker，不需要加入 Service Worker 清理逻辑。

## 本 PR 的防回归措施

- 对生产构建在 `/patrol-retest-demo/` 子目录下运行浏览器测试：桌面与手机、直接管理链接、刷新、首页设置 hash、收藏区入口、返回收藏区、后退/前进，以及旧锚点、关于页、未知路由兜底。
- 分别构建“未配置服务”和“配置服务但未登录”两种状态，并测试最终准备上传到 Pages 的实际构建。外部请求被拦截，不提交登录或上传，不访问真实 Supabase 数据。
- 所有路由回归在 Pages artifact 上传之前执行；失败会阻止该构建进入部署。PR 任务与生产部署使用不同的 concurrency group，避免 PR 检查取消生产发布。分支上的手动任务也不能部署 Pages；仍仅允许 main 的非 PR 任务部署。
- `build-info.json` 记录提交 SHA、base 和实际入口 JS；HTML 的 `meta[name="hitori-build"]` 记录同一 SHA。它们不改变页面外观，也不包含任何密钥。下次发布后可比较标签页 meta 与添加随机查询参数读取的 build-info，识别旧标签页/旧 HTML。
- PR 中的线上诊断只读取静态资源，真实浏览器拦截全部 Supabase 请求。线上诊断仅提供证据，不作为本地候选构建的通过条件。

## 本地复现命令

```sh
npm ci
python -m pip install -r tests/requirements-routing.txt
python -m playwright install --with-deps chromium
npm test
VITE_SUPABASE_URL=https://gallery-test.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_routing_fixture npm run build
python tests/browser-routing.py --configuration login
VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= npm run build
python tests/browser-routing.py --configuration unconfigured
```

已有系统 Chromium 时，可设置 `HITORI_CHROMIUM_EXECUTABLE=/usr/bin/chromium`。

只读检查当前线上版本和登录页（不会提交登录）：

```sh
python scripts/inspect-pages.py https://hitori-gotou1.github.io/patrol-retest-demo/ --browser
```

本 PR 不修改视觉样式、收藏素材、Supabase 配置或数据，也不执行部署。合并到 main 后会按仓库现有工作流自动部署；合并前应完成发布确认。
