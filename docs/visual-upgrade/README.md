# 视觉与动效升级交付 · 2026-11-15

在 `/workspace/patrol-retest-demo` 原项目内完成。保留 Vue 3、Vite、Vue Router、GSAP、五幕内容、角色和图片素材、云端图库、本机收藏、草稿与作品架格式；没有增加运行时依赖。工作开始时 Git 工作区干净。2026-11-16 经确认发布，沿用仓库既有 GitHub Actions → GitHub Pages 流程。

## 八项完成情况

| 项目 | 实现 |
| --- | --- |
| 1. 活动室排版 | 三个真实画面精选前移；手机首张使用较大画幅。空常用区压成一行，有记录时另提供顶部快捷入口。保留最近访问、专题、手记、筛选和完整目录；专题增加票根、手帐、地图 SVG，卡片加入胶带、错落、抬升、缩放和按压反馈。 |
| 2. 图库首屏 | 搜索、分类、收藏和视图切换常显；角色与来源收进「筛选」，启用条件以标签常显并可清空。备份、管理与云端详情收进「备份与工具」，读取失败保留直接重试。390×844 下首张图片可见约 250px 有效画面。 |
| 3. 页面与标签转场 | 路径切换约 280ms；首页锚点和图片查询参数保持同一组件实例。音乐标签增加滑动指示、内容淡入和高度过渡；目录、筛选、工具和剧场札记使用一致折叠节奏。深链接等待前面懒加载章节，滚动任务以最后一次导航为准。 |
| 4. 照片连续动画 | 缩略图到大图约 360ms，遮罩与标题分层出现；关闭约 300ms，来源失效时淡出。切图交叉淡化，结果卡片归位、进出场及墙／流动模式有过渡。动画副本在原生 dialog 顶层且不接收交互，缩放 transform、拖动、双指、焦点、分享历史与旧请求保护继续使用原逻辑。 |
| 5. 分幕氛围 | 开场粉紫融合光；剧场一次手绘线条和纸片；收藏墙淡窗光；音乐区投影与少量尘点／边缘雨线／四色追光；活动室低对比字样与手帐线稿。装饰均 aria-hidden、无指针事件。 |
| 6. 入场与角色节奏 | 标题→主要画面→辅助内容按首次可见错峰入场，每次挂载只播放一次；默认内容可见。角色原有圆形扩散与分层保留，总时长约 800ms；新选择取消旧事务，过期任务不能提交，头像即时响应，键盘与手机滑动保持协调。 |
| 7. 微交互 | 图库收藏成功轻弹，实际存入作品架后出现短暂印章，失败保留真实错误；统一常用曲线、边框、按压与焦点。浅色章节搜索按钮提高对比；手机角色区隐藏悬浮伙伴，图库与音乐区伙伴移至标题旁空位。 |
| 8. 今晚氛围 | 暖灯练习室／雨夜 STARRY／演出前夜，650ms 柔和切换，默认暖灯。本机键 `hitori-room:cinema-mood:v1` 保存选择与动态开关，异常数据和存储失败有降级。三个标签共享氛围，不自动播放、不改音量；仅复用本站播放器现有分析器，暂停／结束／其他媒体接管后回到环境状态。 |

## 实际预览

打开 [截图与录屏预览页](previews/index.html)，或直接查看：

| 页面 | 桌面 1440×900 | 手机 390×844 |
| --- | --- | --- |
| 活动室首屏 | [截图](previews/room-desktop.png) | [截图](previews/room-mobile.png) |
| 图库首屏 | [截图](previews/gallery-desktop.png) | [截图](previews/gallery-mobile.png) |
| 开场 | [截图](previews/home-desktop.png) | [截图](previews/home-mobile.png) |
| 角色 | [截图](previews/about-desktop.png) | [截图](previews/about-mobile.png) |
| 纸箱剧场 | [截图](previews/theater-desktop.png) | [截图](previews/theater-mobile.png) |
| 暖灯练习室 | [截图](previews/mood-warm-desktop.png) | [截图](previews/mood-warm-mobile.png) |
| 雨夜 STARRY | [截图](previews/mood-rain-desktop.png) | [截图](previews/mood-rain-mobile.png) |
| 演出前夜 | [截图](previews/mood-stage-desktop.png) | [截图](previews/mood-stage-mobile.png) |

另有 [768px 活动室](previews/room-tablet.png)、[768px 图库](previews/gallery-tablet.png)、[360px 活动室](previews/room-narrow.png)、[360px 图库](previews/gallery-narrow.png)。这些都是生产构建在 Chromium 中的实际截图。

[短录屏 MP4](previews/visual-tour.mp4) / [WebM](previews/visual-tour.webm)：实际操作首页→活动室→拍贴页→图库，展开、切换并收回照片，再进入音乐区切换三种氛围。没有配假播放状态或自动播放音轨。

## 验证

2026-11-16 发布前补充检查：两种构建配置的管理路由、云端超时恢复、完整活动室／创作／扩展回归均已通过，见 [发布检查记录](release-checks.json)。旧页面现在同步移除，防止切换期间残留的隐藏节点干扰焦点与选择器。

| 检查 | 最终结果 |
| --- | --- |
| `npm test` | 196 项通过，0 失败；[日志](node-tests.log) |
| 图库导入 Python 测试 | 15 项通过；[日志](gallery-import.log) |
| `npm run build` | 生产构建成功，未增加依赖；[日志](build.log) |
| 新视觉／交互验收 | 7 组通过；[报告](browser-results.json) |
| 最后一次照片竞态复验 | 通过；[报告](photo-final-results.json) |
| 现有 V3 角色／舞台／音频回归 | 9 组通过；[报告](existing-v3-results.json) |
| 图库布局与全部素材 | 2 组通过，包含全部 51 张上传收藏；[报告](gallery-results.json) |
| 云端模拟、筛选、备份、分享与恢复 | 5 组通过；[报告](cloud-gallery-results.json) |
| 高清图加载、解码、竞态与失败回退 | 5 组通过；[报告](lightbox-results.json) |

首次进入的测量：桌面精选画面约从 y=416 开始；390×844 手机精选画面约从 y=352 开始，图库首图有效画面约 250px；360px 窄屏约 234px。没有横向溢出。录屏为 1440×900、16.52 秒，MP4 已实际播放与抽帧核验。

最终结果以 [浏览器验收 JSON](browser-results.json) 和本目录测试记录为准。浏览器使用系统 Chromium，覆盖桌面、平板、390×844 与 360px 窄屏；触摸使用浏览器模拟，隐藏页面通过 visibilitychange 模拟。未实测实体手机、Safari 或 Firefox；云端回归使用隔离假配置和拦截响应，不写真实 Supabase。

验证包含：首页五幕；活动室与拍贴页；三个音乐标签；路径、锚点、前进后退与分享刷新；角色快速选择、方向键和滑动；高级筛选、收藏、备份、墙／流动模式、照片展开／收回、快速切图、缩放与双指回归；三种氛围与刷新恢复、真实播放／暂停及其他媒体接管；系统和站内减少动态、存储不可用；离屏／页面隐藏暂停、反复挂载清理；高清图延迟解码、网络／解码失败和失效分享链接。正常路径没有新增控制台错误或横向溢出。

## 关键文件

- `src/components/room/PlayroomHome.vue`、`TopicSketch.vue`：活动入口与专题层级。
- `src/components/GalleryScene.vue`、`src/composables/usePhotoMotion.js`：紧凑图库与照片动画；`useGalleryPreview.js` 保留路由事务，`useGalleryZoom.js` 保留独立手势。
- `src/components/MediaScene.vue`、`MusicPlayer.vue`、`src/room/cinemaMood.js`：氛围选择、本机偏好与单一分析器反馈。
- `src/components/motion/`：背景装饰、统一折叠与内容高度过渡。
- `src/composables/useSceneMotion.js`：首次入场、动态偏好和可见性生命周期；`useCharacterTransition.js`：角色事务与紧凑时序。
- `src/App.vue`、`src/views/RoomLayout.vue`、`src/router.js`、`src/services/sceneAnchor.js`、`useSceneNavigation.js`：路径级转场、深链接与键盘焦点。
- `src/styles/visual-upgrade.css`：视觉细化、响应式、状态反馈与静态降级。
- `tests/browser-visual-upgrade.py`、`tests/cinema-mood.test.js`：新增实际验收与偏好容错检查。已有图库浏览器用例同步了折叠入口和动画完成的等待。

## 预览与复验

当前运行环境另启动了交付预览页：`http://localhost:4174/previews/index.html`。

```sh
npm ci
npm test
npm run test:gallery-import
npm run build
npm run preview -- --port 4173
```

在运行环境访问 `http://localhost:4173/patrol-retest-demo/`。活动室为 `#/room/play`，图库为 `#/#gallery`，音乐区为 `#/#video`。

```sh
HITORI_QA_URL=http://127.0.0.1:4173/patrol-retest-demo/ HITORI_CHROMIUM=/usr/bin/chromium python tests/browser-v3.py
HITORI_QA_URL=http://127.0.0.1:4173/patrol-retest-demo/ HITORI_CHROMIUM=/usr/bin/chromium python tests/browser-gallery.py
HITORI_QA_URL=http://127.0.0.1:4173/patrol-retest-demo/ HITORI_CHROMIUM=/usr/bin/chromium python tests/browser-lightbox.py
python tests/browser-visual-upgrade.py
```

录屏复验需 Playwright 的 FFmpeg：在可写目录安装 `PLAYWRIGHT_BROWSERS_PATH=/tmp/hitori-browser-tools python -m playwright install ffmpeg` 后，加 `PLAYWRIGHT_BROWSERS_PATH=/tmp/hitori-browser-tools HITORI_QA_RECORD=1` 运行最后一项。测试工具不进入网站运行时依赖。
