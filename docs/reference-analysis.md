# 参考项目研究与本次实现决策

## 实际检查范围

参考仓库：[sudoriaa/BOCCHI-THE-ROCK](https://github.com/sudoriaa/BOCCHI-THE-ROCK)。

本次实际读取的提交为 `31f10d41b85f0d260e2a764840ac15ec43e54d24`，检查日期为 2026-10-26。通过 Git 克隆并阅读了项目文件；本文描述该版本的实现，没有将参考项目代码或媒体复制进本站。

## 目录与技术栈

```text
src/
  App.vue                  # RouterView 入口
  main.js
  style.css
  router/index.js          # 首页与登录路由
  views/
    HomeView.vue           # 五幕分屏容器
    LoginView.vue
  components/
    Header.vue
    CharacterInfo.vue
    MusicPlayer.vue
    Photos.vue
    About.vue
public/assets/
  images/ albums/ musics/ videos/ fonts/
```

[package.json](https://github.com/sudoriaa/BOCCHI-THE-ROCK/blob/31f10d41b85f0d260e2a764840ac15ec43e54d24/package.json) 使用 Vue 3.5、Vite 6.3、Vue Router 4.5 和 JavaScript，另列有 Element Plus、Iconify、Tailwind、vuedraggable 等依赖。参考项目没有使用 GSAP，其主要动画来自 Vue Transition 和 CSS keyframes。

[router/index.js](https://github.com/sudoriaa/BOCCHI-THE-ROCK/blob/31f10d41b85f0d260e2a764840ac15ec43e54d24/src/router/index.js) 只有 `/` 和 `/login` 两条业务路由。首页、角色、音乐、相册、关于这五幕都放在 HomeView 中；视觉上不同的“分页”并不意味着每幕都有独立路由。

## 设计与动画实现

| 部分 | 参考实现 | 借鉴与改进方向 |
| --- | --- | --- |
| 全屏首页 | 静音循环背景视频，标题通过 `spinAndLand` 旋转缩放入场 | 保留舞台感、大标题与分层入场；背景资源失败时仍须有可见静态画面，减少动态效果偏好下不播放装饰动画 |
| 分屏导航 | `HomeView.vue` 监听 wheel，按 `innerHeight` 计算下一幕，用原生 `scrollTo({ behavior: 'smooth' })` 滚动 | 保留桌面逐幕节奏；本站使用正常文档流，长内容先读完，手机自然滚动，不把内容锁在固定高度容器中 |
| 角色展示 | 海报、透明立绘、头像、职务、简介、台词和罗马音跑马灯；Vue Transition 配 CSS 淡入、位移、色块转场 | 保留人物为视觉核心和四人配色；资料与界面分离，增加键盘/触摸操作，使用 transform/opacity 减少布局重排 |
| 音乐 | 原生 Audio，曲目列表、切歌、音量和进度、旋转唱片和漂浮音符 | 保留唱片视觉；播放由用户触发，媒体错误要反馈，暂停和卸载时停止动画与资源。参考音符动画并非实时音频频谱 |
| Photos | 三排图片，相邻行反向循环；悬停暂停、放大 | 借鉴交替方向的节奏；本站需有触摸暂停、可关闭动态效果、预览、懒加载。保留当前收藏墙的风格与收藏功能 |
| 关于 | 制作成员和音符装饰 | 提供网站说明、GitHub 和真实来源；不制作本项目不需要的真实登录与后台 |

关键源码：[HomeView.vue](https://github.com/sudoriaa/BOCCHI-THE-ROCK/blob/31f10d41b85f0d260e2a764840ac15ec43e54d24/src/views/HomeView.vue)、[CharacterInfo.vue](https://github.com/sudoriaa/BOCCHI-THE-ROCK/blob/31f10d41b85f0d260e2a764840ac15ec43e54d24/src/components/CharacterInfo.vue)、[MusicPlayer.vue](https://github.com/sudoriaa/BOCCHI-THE-ROCK/blob/31f10d41b85f0d260e2a764840ac15ec43e54d24/src/components/MusicPlayer.vue)、[Photos.vue](https://github.com/sudoriaa/BOCCHI-THE-ROCK/blob/31f10d41b85f0d260e2a764840ac15ec43e54d24/src/components/Photos.vue)。

## 不照搬的实现细节

- 参考 README 明确写明“未适配手机端，仅作为学习参考”。其固定 `100vh`、`overflow: hidden` 分屏容器不适合直接移植到手机和长资料页面。
- Photos 在挂载后通过 `innerHTML += innerHTML` 复制图片节点，缺少预览、懒加载和触摸暂停；Vue 组件中应让框架维护节点，避免手工复制后失去事件和状态管理。
- MusicPlayer 的 `updateProgress()` 每次播放、切歌或跳进度都会再次启动递归 `requestAnimationFrame`，且未见卸载清理。本站必须保持单一动画循环，并清理监听器、音频与计时器。
- 参考图片悬停会改变 width，色块动画改变 left；本站优先使用 transform/opacity。
- 参考主要代码未提供 `prefers-reduced-motion` 处理。本站将减少动态效果作为基础行为。
- 参考项目公共媒体约 248 MB：视频约 115 MB、音乐约 67 MB、图片约 54 MB、字体约 8.8 MB、专辑图片约 3.3 MB。本站不整包引入这些资源。

## 与现有网站的整合决策

按用户本次选择，迁移到 Vue 3 / Vite 组件化工程，保留现有五幕的色彩和叙事：舞台开场、深蓝角色页、淡紫纸箱剧场、奶油收藏墙、暗色音乐放映室。关于信息使用独立 `/about` 路由。首页五幕仍保留 `home`、`about`、`theater`、`gallery`、`video` ID。

Vue Router 使用 hash history，适配 GitHub Pages 项目子目录；章节导航使用 RouterLink，前进/后退交给路由系统，滚动高亮根据实际视口更新。无需为了视觉上的逐幕切换把每幕拆成独立页面。

组件按导航、首页、角色、剧场、相册、音乐和放映室分工；数据单独维护。GSAP 只用于确实需要编排的动画，不引入与当前展示站无关的 UI 框架、拖拽库或后台能力。

## 素材与文案边界

检查版本的仓库根目录没有 LICENSE，README 也没有说明音乐、视频、字体等媒体的再使用授权。可公开访问、注明来源和“开源项目”称呼都不能代替具体素材许可。因此，本项目只借鉴设计理念，不复制参考仓库媒体。音乐采用明确标识的原创演示或有适当权限的来源；其他素材的实际来源与替换位置在本项目素材说明中维护。

没有核实的台词不会伪装成原作引语；原创互动文案继续标注为基于人物性格的想象。
