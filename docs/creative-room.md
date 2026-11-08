# 小屋活动室

入口在主导航“活动室”，地址 `/#/room/rhythm`。原有五幕首页、收藏素材和 Supabase 图库继续使用原来的数据。活动室各页和样式按需加载。

## 六个入口

| 页面 | 地址 | 操作与保存方式 |
| --- | --- | --- |
| 节奏练习 | `/#/room/rhythm` | 三种难度，四拍预备后开始；D/F/J/K 或屏幕按钮演奏，空格暂停/继续。本机保存各难度最高分。切到后台自动暂停，离页停止音效。 |
| 分支剧场 | `/#/room/stories` | 三篇本站原创同人短篇、六个结局。可回到上一幕或重读；按短篇保存进度、结局与上次选择。 |
| 编曲台 | `/#/room/studio` | 四轨十六步，60–180 BPM。本机编排自动保存；导入/分享先预览，确认“保存为本机编排”后才替换原编排。可导出 JSON、复制分享链接。 |
| 练琴计时 | `/#/room/practice` | 练习 1–180 分钟、休息 0–60 分钟。暂停冻结剩余时间，刷新或后台恢复时按截止时间计算；完整完成的练习才计入累计统计，休息后不会自动开始下一轮。 |
| 站主手记 | `/#/room/notes` | 文章列表、搜索、分类、独立文章地址和本机已读标记。首发两篇是开发札记，没有代写站主的个人经历。 |
| 留言与点歌 | `/#/room/guestbook` | 在网站整理内容，使用 GitHub 账号确认提交；站主审核后，已审核快照随网站更新展示。 |

开始演奏会在用户点击后开启已有的互动音效，仍可通过导航静音。浏览器不支持音频时游戏和编排可继续以静音方式操作。练琴提示音默认关闭，仅在明确勾选后开启；后台或很晚恢复时不会补放提示音。

本机存储受限时各功能会提示，编排和练习记录仍可导出。练习历史保留最近 365 次明细；累计次数和分钟继续保留，近期连续天数按保留明细计算。进度属于当前浏览器，不是跨设备云同步。

## 继续写手记和剧情

手记维护在 `src/data/journal.js`。追加一条包含唯一 `slug`、`title`、`date`（YYYY-MM-DD）、`category`、`author`、`summary` 和 `sections` 的记录；每个 section 使用 `heading` / `text`。文字按纯文本渲染，不执行 HTML。提交 PR 并发布后文章出现在列表，可通过 `/#/room/notes/<slug>` 访问。

短篇在 `src/data/roomStories.js`，每篇有唯一 ID、起点和节点表。普通节点提供 `choices: [{text,next}]`，结局节点提供 `ending`。所有分支必须通向有效节点，结局名须在同篇中唯一。自动测试会遍历所有选择，阻止断链。改写旧节点后，过时的阅读路径会回到起点，仍有效的已解锁结局继续保留。

## 来信审核与发布

内容在提交到 GitHub 时已经公开；网站只展示审核通过的快照。它不提供匿名投递，也不需要新增 Supabase 表、服务端密钥或前端 GitHub token。

1. 访客在活动室填写留言或点歌，确认公开提交说明，打开 GitHub 后登录、检查并提交。仓库模板 `.github/ISSUE_TEMPLATE/guestbook.md` 自动标记 `hitori-guestbook`。
2. 站主在仓库 Issues 中查看 `hitori-guestbook` 来信。确认内容后添加 `hitori-approved` 标签。仓库站主，或具有 write / maintain / admin / triage 权限的审核者可以批准。
3. `community-publish.yml` 在可信 main 上执行审核处理器，确认审核者权限、当前标签、状态及内容版本。只把被审核的文本写入 `public/community/guestbook.json`，保留最近 100 封。并发更新使用文件 SHA 校验和重试，避免覆盖其他来信。
4. 处理器显式触发 `deploy.yml`；经过全部构建、路由、图库和活动室测试后发布。GitHub 的 `GITHUB_TOKEN` 提交不会自行触发通常的 push 流程，因此必须显式 dispatch。[GitHub 官方说明](https://docs.github.com/en/actions/concepts/security/github_token)
5. 编辑、重新打开、关闭、删除来信或移除审核标签会撤下快照，并移除批准标签；修改后的内容需要重新审核。未审核的修改不会直接进入网站。撤下生效需要等待相应工作流和发布完成。

首次发布的 `community-setup` 作业会幂等创建上述两个标签。需要的权限仅由 GitHub Actions 在对应作业中提供：初始化 labels 使用 issues:write；审核使用 contents:write、issues:write、actions:write。网站前端只读取本站的公开快照，不保存或请求 GitHub 写入凭据。

若快照提交成功而发布触发失败，可重跑该审核作业；处理器会重试发布，不重复追加内容。也可在 Actions 中手动运行 “Build and deploy Hitori Room”。如果将来给 main 增加分支保护，应同时为审核发布流程配置允许的数据更新方式。

## 验证

```sh
npm test
node tests/room-core.test.js
node tests/room-moderation.test.js
npm run build
python tests/browser-room.py
```

浏览器测试使用 Playwright/Chromium（`tests/requirements-browser.txt`）；本地系统 Chromium 可通过 `HITORI_CHROMIUM_EXECUTABLE=/usr/bin/chromium` 指定。可用 `--case rhythm|stories|studio|practice|journal|guestbook|lifecycle|layouts` 定向运行。

测试通过假时钟验证计分、暂停、后台计时、刷新恢复和结束记账，通过模拟 GitHub API 验证审核权限、篡改与撤回、并发冲突和发布重试。浏览器测试拦截外部请求，不向 GitHub 发布测试留言，也不读写真实 Supabase 数据。
