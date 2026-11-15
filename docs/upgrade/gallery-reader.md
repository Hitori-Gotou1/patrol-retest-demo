# 云端图库读取与预览（10、18）

基于已核对的线上提交 `219c550` 迭代，保留静态收藏、旧收藏编号与备份、Hash 单图分享、浏览历史、流动视图及原有来源档案。

## 用户可见行为

- 首批请求至多显示 36 张云端图片，收到即与仓库图片一起显示。之后通过「再翻」「读取更多云端收藏」读取后页，并明确显示已读数量、读取中、结束、失败与重试。
- 关键词、角色、分类、画师和我的收藏的筛选会主动逐页检索**全部云端元数据**。尚未读完时写明“正在检索全部”，数量标为“已读取/当前符合”，不将部分数据冒充完整结果，也不会提前报“没有符合条件”。筛选结束后才显示完整命中数。
- 后页失败保留已读取图片；「重试读取」从失败位置继续。显式「刷新云端收藏」重新校验首批，成功前保留现有数据。
- 仅缓存元数据于当前页面运行进程，跨路由复用 5 分钟；过期进入时重新读取，手动刷新立即失效。缓存不存原图，不涉及作品或草稿容量。站主管理变更通过独立缓存失效通知接入。
- 未加载图片的分享地址会单独按 ID 查询，能够直接打开，不要求先扫描整个图库。原有 Hash 链接、后退关闭、前进恢复、关闭焦点返回继续有效。
- 大图使用中尺寸预览（有 `preview_path` 时），没有中图的旧记录回退原有图片字段。列表仍只读缩略图；原图由「查看原图」主动打开。原有缩略图到预览的解码、失败回退与快速切图保护继续使用。
- 预览增加缩小、放大、适配屏幕、1:1 查看及双击还原。放大后可拖动，手机支持双击、按钮缩放和放大后的双指调整；适配状态水平滑动仍可切图。切图、关闭和窗口尺寸变化都重置或限制位移，避免丢失图片。
- `+`/`−` 内部缩放，`0` 适配，`1` 以预览图像素一比一查看，Shift + 方向键移动放大图片。普通方向键仍切图。Ctrl/⌘/Alt 组合保留浏览器行为，不拦截浏览器页面缩放；适配状态保留浏览器双指缩放。
- 显式角色数组优先，旧记录继续文本识别。新增 tags 纳入搜索。云端主动记录的作者/来源不会再被静态来源映射中的空值清除。

## 数据与兼容

公开请求不初始化认证 SDK；仍使用项目公开 key、匿名只读 REST 和后端 RLS。新结构按 `sort_order asc, created_at desc, id desc` 进行 keyset 分页，以避免新增记录导致 offset 滑动；聚合按同一顺序去重。旧服务缺少新字段时，检测 `42703/PGRST204` 后退回旧排序与旧公开结构。迁移、发布状态和权限策略由 gallery-admin 模块交付。

每次重新刷新具有请求代号；即使旧请求忽略 AbortSignal，迟到结果也不能覆盖新结果。请求超时沿用 12 秒整体截止。分页位置不前进会停止并提示重试，避免无限扫页。路由卸载会终止请求、逐页检索、图片解码、观察器及监听器。

`src/services/galleryPager.js` 为分页、缓存和请求合并的纯逻辑；`src/services/galleryZoom.js` 为适配与边界计算；Vue 组合函数负责指针与焦点生命周期。未新增服务端管理凭据。

## 实际验证

2026-11-14：

- 生产构建成功。浏览器套件使用明确指定的 `gallery-test.supabase.co` 构建及本地 REST 契约数据，**未写生产 Supabase，不能将其描述为生产后端验收**。
- 新增 Node 测试 `tests/gallery-pager.test.js` 10 项通过：首批发布、全量检索、请求合并、去重排序、失败续读、迟到请求、缓存 TTL、取消、分页循环防护及图像边界。
- 既有图库搜索/收藏测试 8 项、渐进解码测试 10 项通过；新增显式标签搜索用例。
- `tests/browser-gallery-upgrade.py` 在真实 Chromium 完成 24 项检查：80 条测试数据只先读 36 条；第三批命中；完整搜索进度与失败恢复；按 ID 定位；实际双击、拖动、焦点恢复；360、430、768 CSS 像素触摸与无横向溢出、44px 关闭按钮。
- 既有 `browser-gallery-discovery.py` 五组全部通过：搜索、备份、分享历史与剪贴板、云端链接失败恢复、跨标签页与手机。
- 既有 `browser-lightbox.py` 五组全部通过：真实原生解码、乱序请求、失败回退、关闭卸载、已缓存与无缩略图。
- 无未捕获浏览器页面异常。截图已实际打开检查。没有声称性能提升百分比或虚构耗时。

结果：`evidence/gallery-upgrade/results.json`、`evidence/gallery-discovery/results.json`、`evidence/gallery-lightbox/results.json`。
截图：`evidence/gallery-upgrade/gallery-desktop.png`、`gallery-preview-360.png`、`gallery-preview-430.png`、`gallery-preview-768.png`。

复跑（仅本地契约后端）：

```sh
VITE_SUPABASE_URL=https://gallery-test.supabase.co \
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_discovery_fixture \
npm run build -- --outDir /tmp/hitori-gallery-reader-dist
node --test tests/gallery-pager.test.js tests/gallery-discovery.test.js tests/progressive-image.test.js
HITORI_CHROMIUM_EXECUTABLE=/usr/bin/chromium python tests/browser-gallery-upgrade.py --dist /tmp/hitori-gallery-reader-dist
HITORI_CHROMIUM_EXECUTABLE=/usr/bin/chromium python tests/browser-gallery-discovery.py --dist /tmp/hitori-gallery-reader-dist
```

尚未覆盖真实移动设备、Safari/Firefox 的原生手势；目前触摸验证为真实 Chromium 的移动视口与触摸输入。
