# 活动发现、手机创作与模板（1 / 2 / 3 / 4 / 19 / 20）

在继承线上 `219c550` 的基础上实现。

## 用户能看到的变化

- 活动室最上方增加「演出项目 / 乐队日历 / 现实中的下北泽」专题卡片。五个已有专题均纳入活动目录、分类、搜索与最近访问，保留三个实际画面的精选活动。收藏来源档案继续使用已有来源内容，没有补采旧收藏。
- 导航使用「搜索与设置」，手机使用放大镜 SVG 与明确可访问名称。Ctrl / ⌘ K、原生对话框 Esc 关闭、关闭后的焦点恢复继续有效。搜索结果按内容 ID 去重。
- 常用活动与最近访问分开表达。活动目录和活动内均能加入 / 取消常用；快捷区可前后排序。同标签页及跨标签页立即更新，不依赖登录。
- 拍贴、漫画、房间、涂鸦、灯光使用同一个手机编辑工作区；编曲由音频模块接入相同组件。画布保留在视野内，下方工具独立滚动，支持收起工具看完整画面、全屏编辑、明确退出、Esc 和焦点恢复。全屏内可真实导出图片、存入原有作品架，继续遵守已有作品容量限制。
- 横屏使用画布 / 工具双栏；竖屏使用上下分区。安全区域、动态视口高度、软键盘下画布压缩、画布触摸与页面滚动分别处理。灯光手机时间轴分为四组、每组四步，避免缩小十六个按钮；播放时跟随所在分段。
- 拍贴、漫画、灯光和编曲各有两套原创可编辑模板。主题包括生日合影、演出夜和雨天日常；模板预览直接来自真实 payload。使用模板时先保留当前草稿，保留失败便不覆盖，提供恢复入口。模板与作品分离。

## 文件与维护

- `src/components/tools/EditorWorkspace.vue`：通用编辑布局、全屏、焦点、作品架保存；采用 `canvas / tools / actions` slots。
- `src/styles/mobile-workspace.css`：活动专题、常用区、触控、导航及手机工具基础规则，由 `RoomLayout.vue` 引入。
- `src/room/activityFavorites.js`：`hitori-room:activity-favorites:v1` 保存有序 activity ID 数组，校验去重、最多 100 条，仅保留已知活动。
- `src/room/templates.js`：模板目录、实际数据、替换前草稿保留。增加模板时提供唯一 ID、tool、中文标题 / 简介和可通过对应工具校验的 `make()`；每种工具少量完整模板。`TemplateLibrary.vue` 负责真实预览与安全应用。
- 替换前草稿槽为 `hitori-room:template-previous:v1:{tool}`；每个支持模板的工具仅一份、上限 1 MiB，不是统一备份系统，也没有扩大作品架。
- `captureWorkPreview` 优先选择实际 `.editor-workspace-canvas`，防止展开模板时误把模板图保存为作品预览。

## 实测

执行：

```sh
node tests/mobile-templates.test.js
npm run build -- --outDir /tmp/hitori-mobile-dist
HITORI_MOBILE_DIST=/tmp/hitori-mobile-dist python tests/browser-mobile-upgrade.py
```

- 4 项数据逻辑测试通过：八套模板校验与副本隔离；替换前草稿与存储失败；常用活动排序 / 去重 / 删除 / 无效输入；专题分类与保留三精选。
- 实际 Chromium 验证 `320×740 / 390×844 / 430×932 / 768×1024 / 1440×1000 / 844×390` 共 36 个页面视口组合，无意外页面横向溢出、无 JS 页面错误。
- 五种创作工具在六个视口均完成全屏进入 / 退出及焦点恢复；手机灯光分段 12 个可见步按钮（3 束灯 × 4 步），步按钮及主要工作区操作达到 44px。
- 390px 手机完成合影文字编辑、漫画对白编辑、房间添加物件、真实触摸涂鸦、灯光选择分段；五类均真实下载 PNG。手机拍贴还实测作品架保存、套用模板、恢复原草稿。常用活动跨标签页取消立即生效；搜索对话框 Esc 关闭并恢复焦点。
- 真实 PNG 已用图片解码器读取：拍贴 1080×1350、漫画 1260×870、房间 1440×930、涂鸦 900×600、灯光 1350×780；全部为实际 PNG，涂鸦含真实笔迹像素。
- 首轮真实浏览器发现全屏退出时进入按钮被 `v-if` 换成新节点导致焦点丢失，已修复并复测通过。
- `evidence/mobile/report.json` 保存完整检查结果，截图及实际输出文件同目录。自动化使用真实 Chromium，未宣称实机 Safari / iOS 软键盘已验收。

旧 `browser-experience.py` 的计数改为 33 个目录入口 / 7 个创作入口，首屏检查改为新增专题卡片；保留三精选实际画面与旧作品架行为的检查。

## 原有功能回归

`browser-experience.py` 已在独立生产构建 `/tmp/hitori-mobile-final-dist` 完整通过：1440 / 390 / 320px 的专题首屏、三精选、目录筛选、旧作品版本保存 / 恢复 / 删除撤销 / 备份合并、恶意 SVG 预览拒绝、浏览器存储失败、手记与原曲导听 / 播放切换均通过。专题第一张卡片距页面顶部分别 444 / 381 / 372px。没有页面 JS 错误或缺失资源。

`browser-experience.py` / `browser-expansion.py` 新增 `HITORI_QA_DIST`，便于对固定构建复核，避免其他模块构建更新干扰正在运行的回归。

真实截图还发现普通手机页面的浮动伙伴可能盖住编辑器顶部保存按钮，已向负责全站伙伴布局的主代理提供 `evidence/regression-playroom/photobooth-320.png` 定位；全屏编辑因独立层级不受遮挡。编曲实际画面另发现画布区动作可能被裁切，通用手机全屏画布现允许区域内纵向滚动，确保播放 / 参数入口可达。

最终再次独立构建并完成：

- `HITORI_QA_DIST=/tmp/hitori-mobile-final-dist HITORI_CHROMIUM=/usr/bin/chromium python tests/browser-expansion.py`：完整通过，18 个专题 / 作品页视口组合；新手作品引导、版本整理与备份、房间挂画、完整演出真实声音 / 灯光共时基准 / 完成计数 / 后台停止 / JSON / PNG / 作品架、搜索及阅读设置、51 张作者未确认的旧收藏保持原状、日历 ICS、巡礼链接与收藏、真实本机计数、13 篇无 JS 静态正文与 OG / sitemap 均通过。无 JS 错误或缺失资源。
- `HITORI_CHROMIUM_EXECUTABLE=/usr/bin/chromium python tests/browser-playroom.py --dist /tmp/hitori-mobile-final-dist`：7 组全部通过（拍贴、房间、散步、寻物、演出筹备、环境声、布局及存储失败）。结果文件 `evidence/regression-playroom/results.json`。环境声按新契约实测独立 AudioContext，互动音效开关不打断环境声，总静音停止、解除静音不会自动播放，后台停止、切页关闭环境声上下文及重开保留场景收藏均通过。

必要的旧测试更新只覆盖真实产品变化：设置按钮名称、专题增加后的目录计数、允许 sitemap 增加页面但继续要求 13 篇原手记、三个声音通道独立。没有移除失败处理、旧数据、真实导出或无障碍断言。
