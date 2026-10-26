# 一里小屋 · HITORI ROOM

《孤独摇滚！》主题同人展示站。保留舞台开场、深蓝角色页、淡紫纸箱剧场、奶油色收藏墙与暗色音乐放映室五幕风格，使用 **Vue 3 Composition API + Vite + Vue Router + GSAP**。无需后台、数据库或登录。

公开网站：https://hitori-gotou1.github.io/patrol-retest-demo/

## 安装、运行与构建

需要 Node.js **22.12+**（推荐 Node 22 LTS，见 `.nvmrc`）。

```sh
npm ci
npm run dev
```

访问终端显示的地址，默认 `http://localhost:5173/patrol-retest-demo/`。云环境的本地端口与公开网站是两个地址。

```sh
npm run build
npm run preview
```

构建结果是 `dist/`，预览默认使用端口 4173。迁移后不能再用 Python 静态服务器直接运行源文件；可以用静态服务器托管构建后的 `dist/`。

## 功能

- 固定导航、桌面平滑逐幕滚动、活动区域高亮；手机自然滚动，长内容完整可读。
- 全屏插画开场、GSAP 分层入场、轻微指针视差和舞台光效；可选静音背景视频，失败时保留静态封面。
- 四位成员数据驱动展示：中文、日文、罗马音、职务、性格、背景、声优与原创角色印象。主题色、图形及文字同步过渡，支持方向键、Home/End、前后按钮和横向触摸。
- 纸箱情境切换、点击角色回应、明确点击才响起的原创合成短和弦。
- 相册「收藏墙 / 流动视图」双模式：分类、本机收藏、三排交错循环、暂停、懒加载、全屏预览、方向键和触摸切图。
- 音乐播放器：三首本站原创 Demo、播放/暂停、上下首、进度拖动、音量、旋转唱片、实际音频频谱。不会自动播放有声音乐。
- 私人视频预览保留，与音乐互斥播放；本地文件不上传。关于页包含简介、GitHub 与致谢。
- 减少动态效果、离屏暂停图片墙、页面隐藏暂停音频，卸载时清理监听器、音频、对象 URL 和 GSAP 动画。

## 目录

```text
src/
  main.js / App.vue / router.js   Vue 入口、公共导航、Hash 路由
  views/HomeView.vue             组装五幕
  views/AboutView.vue            关于与致谢
  components/
    SiteNavigation.vue           导航
    HeroScene.vue                开场
    CharacterScene.vue           成员展示
    TheaterScene.vue             脑内剧场
    GalleryScene.vue             收藏墙 / 流动相册 / 弹窗
    MediaScene.vue               音乐 / 视频切换
    MusicPlayer.vue              音频播放器与频谱
  composables/
    useSceneNavigation.js        分屏、活动状态及键盘焦点
    useChord.js                  点击触发的合成和弦
  data/
    characters.json              成员资料与配色
    gallery.js                   图片、分类和来源
    music.json                   曲目、封面和来源
    site.js                      封面与可选视频
  styles/                        基础样式、各幕样式与主题变量
public/assets/                   插画、原创图形和演示音频
scripts/generate-demo-audio.py   标准库生成原创练习音频
.github/workflows/deploy.yml     构建并发布 GitHub Pages
```

主题颜色、常用间距单位和动画时长位于 `src/styles/enhancements.css`；角色主题色位于角色数据。CSS 负责简单悬停、唱片和图片墙循环，GSAP 只负责首页与角色的分层时间线，不引入 UI 组件库、图标库或额外滚动库。

## 继续补充内容

- **角色**：修改 `src/data/characters.json`。目前使用本站原创几何人物占位；获得适当许可的立绘后，放入 `public/assets/characters/`，替换 `portrait`、`portraitAlt`，同步调整 `CharacterScene.vue` 的占位说明。原官网立绘已从当前版本移除。`originalLine` 明确标为原创角色印象，未核实的文案不冒充动画台词。
- **相册**：将素材放入 `public/assets/`，修改 `src/data/gallery.js`。支持 `illustration`、`poster`；计数自动更新。只有三张素材时，流动视图会有意重复，之后增加图片即可丰富内容。
- **音乐**：修改 `src/data/music.json`。目前三段 12 秒音频是本站合成练习，不是结束乐队原曲。详情与重生成命令见 [音频来源](public/assets/audio/SOURCES.md)。替换为已获授权的文件，或另外接入允许嵌入的平台播放器；普通视频网站观看页不能直接作为 `audio.src`。
- **背景视频**：`src/data/site.js` 的 `backgroundVideo` 默认空，使用插画与灯光动画。填入 `assets/your-background.webm` 等授权素材路径后，页面会静音播放；加载失败或减少动态效果模式使用静态封面。
- **公开视频**：填写 `site.video.src/title/description/poster`。页面上的本地视频选择只在当前浏览器预览，不会发布给其他访客。

数据中路径写成 `assets/example.webp`，不要带域名或开头 `/`；组件统一加 `import.meta.env.BASE_URL`。本站使用系统字体，不下载未知授权字体。

## 部署

Vite 的 `base` 为 `/patrol-retest-demo/`。GitHub Pages 的 Source 使用 **GitHub Actions**；推送 `main` 后工作流运行 `npm ci`、`npm run build` 并上传 `dist/`。

Vue Router 使用 Hash 路由，关于页 `/#/about` 可直接刷新，无需服务器 rewrite。首页各幕链接形如 `/#/#gallery`；迁移前的 `/#gallery` 链接也会转换到对应幕。更换仓库名或部署到域名根目录时，同步修改 `vite.config.js` 的 `base`。

## 研究与选择

已实际阅读参考仓库，技术和实现分析见 [参考项目分析](docs/reference-analysis.md)，包括固定版本源码链接。本站没有复制它的源码、歌曲、视频或字体。

本次确认的方向：迁移 Vue 但保留五幕；保留收藏墙并增加流动模式；官网立绘换原创图形占位。音乐并入第五幕，关于使用单独路由，纸箱和视频预览继续保留。更多阶段记录与验证见 [开发记录](docs/development.md)。
