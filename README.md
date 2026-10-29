# 一里小屋 · HITORI ROOM

《孤独摇滚！》主题同人展示站。保留舞台开场、整幕四色角色页、淡紫纸箱剧场、奶油色收藏墙与暗色音乐放映室五幕风格，使用 **Vue 3 Composition API + Vite + Vue Router + GSAP**。无需后台、数据库或登录。

公开网站：https://hitori-gotou1.github.io/patrol-retest-demo/

## 安装、运行与构建

需要 Node.js **22.12+**（推荐 Node 22 LTS，见 `.nvmrc`）。

```sh
npm ci
npm run dev
```

访问终端显示的地址，默认 `http://localhost:5173/patrol-retest-demo/`。云环境的本地端口与公开网站是两个地址。

```sh
npm test
npm run build
npm run preview
```

构建结果是 `dist/`，预览默认使用端口 4173。迁移后不能再用 Python 静态服务器直接运行源文件；可以用静态服务器托管构建后的 `dist/`。

## 功能

- 固定导航、桌面平滑逐幕滚动、活动区域高亮；手机自然滚动，长内容完整可读。
- 全屏插画开场、GSAP 分层入场、轻微指针视差和舞台光效；可选静音背景视频，失败时保留静态封面。
- 角色整幕按粉 / 黄 / 蓝 / 红切换主题，约 1.44 秒的双背景层圆形扩散，覆盖手机长区域所有角落；人物、英文姓名和资料分层入场，快速连点只保留最后目标。
- 四位成员数据驱动展示：中文、日文、罗马音、职务、性格、背景、声优与原创角色印象。主题色、图形及文字同步过渡，支持方向键、Home/End、前后按钮和横向触摸。
- 角色专属彩蛋：轻点人物出现原创回应；波奇连续互动会害羞、慌张并躲进可点击的 SVG 纸箱。
- 可展开的吉他、贝斯和电子鼓互动。全站互动音效默认静音，由导航开关主动开启；音量独立于音乐播放器，原有纸箱短和弦也遵守该开关。
- STARRY 演出模式：按需加载、四人依次登场、三种灯光、成员聚光、节拍反馈，以及跳过、重播、退出。
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
    CharacterEasterEgg.vue        独立容器内的角色反应与纸箱
    InstrumentPanel.vue          可折叠乐器面板
    InteractionSoundControl.vue  全站互动音效开关与音量
    StarryLiveMode.vue           按需加载的舞台模态体验
    TheaterScene.vue             脑内剧场
    GalleryScene.vue             收藏墙 / 流动相册 / 弹窗
    MediaScene.vue               音乐 / 视频切换
    MusicPlayer.vue              音频播放器与频谱
  composables/
    useSceneNavigation.js        分屏、活动状态及键盘焦点
    useChord.js                  点击触发的合成和弦
    useCharacterTransition.js    角色圆形扩散、时序、交互与资源清理
    useInteractionAudio.js       共享短音效与按调用者清理
    useInteractionSession.js     舞台状态，暂停背景角色动画
    interactionCounter.js        带时间窗口及冷却的连击计数
  audio/interactionAudioEngine.js 合成音色、声部上限与异步播放保护
  data/
    characters.json              成员资料与配色
    gallery.js                   图片、分类和来源
    music.json                   曲目、封面和来源
    site.js                      封面与可选视频
    interactions.js              互动功能开关、连击参数、台词、纸箱路径
    instruments.js               乐器、调弦、鼓点与快捷键
  styles/                        基础样式、各幕样式与主题变量
tests/character-reveal.test.js   圆形覆盖与手机长区域的几何回归
public/assets/                   插画、原创图形和演示音频
scripts/generate-demo-audio.py   标准库生成原创练习音频
.github/workflows/deploy.yml     构建并发布 GitHub Pages
```

主题颜色、常用间距单位和动画时长位于 `src/styles/enhancements.css`；角色主题色位于角色数据。CSS 负责简单悬停、唱片和图片墙循环，GSAP 负责入场、转场与短暂互动，不引入 UI 组件库、图标库或额外滚动库。

## V3 互动操作与配置

1. **角色彩蛋**：轻点任意角色。波奇在 4 秒内有效点击 3 次会慌张，5 次躲进纸箱；点击间隔至少 180 毫秒，避免误触重复计数。轻点纸箱叫她出来。换人、离开角色区域、切换页面或进入舞台都会清理彩蛋。
2. **乐器**：角色资料下展开乐器面板，点击琴弦或鼓面。虹夏鼓面获得焦点后可按 A / S / D。喜多面板带麦克风装饰，不录音。导航「音效 关」是全站互动声开关，旁边设置可调节音量；音乐播放器仍使用自己的播放和音量控制。
3. **演出模式**：在第三幕「纸箱剧场」点击 **ENTER STARRY**。开场约 3.65 秒，可跳过；三种灯光与成员按钮控制聚光，节拍按钮触发短灯光反馈。右上角「离开舞台」或 Esc 退出，回到入口，角色选择不变。

`src/data/interactions.js` 中的 `interactionFeatures.easterEggs / instruments / liveMode` 可分别设为 `false`，然后重新构建发布。连击阈值、时间窗口、台词和纸箱路径在同文件调整。纸箱是本站绘制 SVG，可用自备素材替换 `public/assets/interactions/bocchi-box.svg`。上方大立绘与 STARRY 舞台沿用原有四张全身 PNG；下方角色选择按钮的小图标和大立绘右下方的 Q 版小伙伴共用站主提供的四张 `*-chibi.png`，无需补充素材。小伙伴等比完整展示，与大立绘共用转场、漂浮和彩蛋容器，一起躲箱和恢复，不增加循环动画或依赖。

音效由 Web Audio 合成吉他、贝斯、底鼓、军鼓、镲片和短和弦，最多同时 5 个声部；它们是互动示范音色。STARRY 是视觉舞台，使用原有站姿立绘，没有人物弹奏动作或自动播放的演唱会歌曲。浏览器减少动画设置下，纸箱、成员切换和舞台仍可操作，省去大幅动画。

## 互动回归测试

`npm test` 运行 Node 内置测试，验证圆形覆盖、连击窗口与冷却、音频默认静音、声部上限及延迟 `resume()` 竞态。GitHub Actions 沿用该命令。

真实浏览器用例在 `tests/browser-v3.py`，覆盖角色切换、彩蛋、手机触摸、键盘焦点、乐器、音乐隔离、舞台生命周期、相册和减少动画。首次使用可在虚拟环境安装测试工具；它们不进入站点依赖：

```sh
python -m venv .venv
. .venv/bin/activate
python -m pip install playwright
python -m playwright install chromium
npm run build
npm run preview
```

另开终端运行：

```sh
HITORI_QA_URL=http://127.0.0.1:4173/patrol-retest-demo/ .venv/bin/python tests/browser-v3.py
```

默认测试端口为 5173；测试构建结果时加 `HITORI_QA_URL=http://127.0.0.1:4173/patrol-retest-demo/`。结果及截图默认写入 `/tmp/hitori-v3-qa/`，可通过 `HITORI_QA_OUTPUT` 更改。后台清理用例模拟 `visibilitychange`，浏览器测试目前覆盖 Chromium，尚未实测 Safari / Firefox。

新增收藏的分页、分类、流动视图、焦点恢复和全部 39 张图片预览，使用 `python tests/browser-gallery.py` 检查，默认连接 4173 生产预览。它同样支持 `HITORI_QA_URL`、`HITORI_QA_OUTPUT`、`HITORI_CHROMIUM`，默认输出 `/tmp/gallery-qa/`；`HITORI_QA_CASE=layouts` 或 `assets` 可只复测一组。

## 继续补充内容

- **角色**：修改 `src/data/characters.json`。上方大立绘与 STARRY 舞台沿用站主提供的 `hitori.png`、`nijika.png`、`ryo.png`、`kita.png`。下方角色选择按钮与大立绘旁的小伙伴通过独立的 `thumbnail`、`thumbnailSize` 共用四张 `*-chibi.png`，原图没有像素修改。以后更换素材时放入 `public/assets/characters/`；大立绘修改 `portrait`、`portraitAlt`、`portraitSize`，Q 版素材修改 `thumbnail`、`thumbnailSize`。在 `portraitLayout.scale/x/y/objectPosition` 配置完整人物比例/位置，在 `portraitLayout.thumbnailPosition/thumbnailScale/thumbnailOrigin` 单独配置头像取景；`companionLayout.scale/x` 调整完整 Q 版小伙伴的留白补偿与横向位置。`theme` 管理配色、`motion` 管理动作参数；具体字段与素材记录见 [人物素材说明](public/assets/characters/SOURCES.md)。`originalLine` 明确标为原创角色印象，未核实的文案不冒充动画台词。
- **相册**：原有 3 张作品和 `src/data/gallery-upload.json` 中的 39 张站主收藏合并为 42 张，入口在 `src/data/gallery.js`。支持 `collection`、`illustration`、`poster`，收藏墙每次展示 9 张；预览和流动视图仍能浏览完整分类。新增素材放入 `public/assets/`，配置 `src`（预览）、可选的 `thumbnail`（列表）、`originalSrc`（查看原图）、真实 `width/height` 与来源。小图不强制放大；大图在列表使用轻量副本，原文件保留。详细映射见 [收藏素材记录](public/assets/gallery/2026-10-29/SOURCES.md)。原有收藏 ID 和本机收藏记录继续有效。
- **音乐**：修改 `src/data/music.json`。目前三段 12 秒音频是本站合成练习，不是结束乐队原曲。详情与重生成命令见 [音频来源](public/assets/audio/SOURCES.md)。替换为已获授权的文件，或另外接入允许嵌入的平台播放器；普通视频网站观看页不能直接作为 `audio.src`。
- **背景视频**：`src/data/site.js` 的 `backgroundVideo` 默认空，使用插画与灯光动画。填入 `assets/your-background.webm` 等授权素材路径后，页面会静音播放；加载失败或减少动态效果模式使用静态封面。
- **公开视频**：填写 `site.video.src/title/description/poster`。页面上的本地视频选择只在当前浏览器预览，不会发布给其他访客。

数据中路径写成 `assets/example.webp`，不要带域名或开头 `/`；组件统一加 `import.meta.env.BASE_URL`。本站使用系统字体，不下载未知授权字体。

## 部署

Vite 的 `base` 为 `/patrol-retest-demo/`。GitHub Pages 的 Source 使用 **GitHub Actions**；推送 `main` 后工作流运行 `npm ci`、`npm test`、`npm run build` 并上传 `dist/`。升级前的已验收版本保存在 `v2.0-stable` 标签中。

Vue Router 使用 Hash 路由，关于页 `/#/about` 可直接刷新，无需服务器 rewrite。首页各幕链接形如 `/#/#gallery`；迁移前的 `/#gallery` 链接也会转换到对应幕。更换仓库名或部署到域名根目录时，同步修改 `vite.config.js` 的 `base`。

## 研究与选择

已实际阅读参考仓库，技术和实现分析见 [参考项目分析](docs/reference-analysis.md)，包括固定版本源码链接。本站没有复制它的源码、歌曲、视频或字体。

本次确认的方向：迁移 Vue 但保留五幕；保留收藏墙并增加流动模式；官网立绘换原创图形占位。音乐并入第五幕，关于使用单独路由，纸箱和视频预览继续保留。更多阶段记录与验证见 [开发记录](docs/development.md)。
