# 设备、离线与可选跨设备同步（27、28）

入口为 `/#/settings/device`，由全站「搜索与设置」面板提供链接。公开网站部署方式仍为 GitHub Pages；没有新服务或站点发布。

## 已实现的行为

- 正确的 Manifest、192/512 PNG 图标和独立窗口启动地址；支持原生安装提示的浏览器可安装，其他浏览器提供菜单操作说明。
- 生产构建生成与当前模块依赖图一致的 Service Worker。初次注册仅保存很小的离线说明页；不默认下载所有玩法、图库或媒体。
- 用户可勾选拍贴、房间布置、漫画、涂鸦、灯光、编曲、练琴、节奏、分支故事和散步。缓存按模块静态依赖和 CSS 展开，必要人物素材独立加入，两个请求并发下载。
- 所选玩法完整下载后才标记成功；页面显示实际 CacheStorage 字节数、资源数和下载进度，提供更新与清理。
- 更新安装阶段先准备新版本及原先所选玩法。旧页面继续使用旧资源；用户明确点更新后才接管和刷新，保留上一代缓存供已打开标签使用。HTML 与当前入口散列不匹配时停止缓存，避免混用。
- 清理只删除资源缓存，保留很小的离线基础页，不触碰 localStorage、作品、草稿或计时记录。
- 本机功能不依赖账号。同步使用同一 Supabase 项目和公开连接，使用独立访客认证存储，不借用站主会话；登录、申请邮箱验证、退出均调用真实 Auth API。
- 用户登录后需选择同步并查看首次合并预览，之后才连接。支持保存作品版本、各工具草稿、图片收藏、常用活动及排序、最近 365 条练琴日志、节奏三档最高分。正在运行的计时器和未列明的进度不参与同步。
- 作品版本与草稿分别记录。每条记录有服务端修订号、内容 SHA-256、操作 UUID 和删除标记；本机意图在请求前写入持久 outbox，联网后重试。服务端拒绝旧修订，网络丢失重试保持幂等。
- 首次连接合并不同编号的记录，空设备不会覆盖云端作品。同编号作品、草稿或练琴记录并发变动进入冲突列表，由用户保留本机、采用云端，或将云端另存作品版本。收藏并发删除优先，节奏最高分取较高值。
- 合并前复用原作品架校验，仍限制 24 个版本 / 3 MiB。单作品和草稿限制保留。合并超限或数据无效时停止，不自动丢弃作品，也不扩容。
- 退出和关闭同步保留本机内容及其账号关联。切换到另一个账号前，要求原账号已成功同步、没有 outbox/冲突且本机摘要未变化；随后加载另一个账号的范围。未同步时会阻止切换，不将原账号作品传给新账号。每个写请求冻结其认证令牌，切号不会让旧数据套用新账号令牌。

## 真实后端配置

已经从线上确认并复用了实际 Supabase 项目公开 URL / anon key；这些不是服务端管理凭据。根验收记录 `evidence/backend-public-read.json` 显示：原图库可读，但 `hitori_sync_records` 返回 `PGRST205`（表尚不存在）。

数据库迁移已由站主执行。部署到同一项目时配置如下：

1. `supabase/migrations/20261114_device_sync.sql`。
2. Supabase Auth 启用邮箱密码认证；如允许访客自行创建同步账号，开启邮箱验证和注册，将真实站点地址加入 Site URL / Redirect URLs。若关闭注册，则由站主创建独立访客账号。无需把密码或管理密钥放入前端。
3. 实连回归使用两个专用隔离测试账号，用下面的脚本验证 RLS / RPC。2026-11-15 已通过真实 Auth/RLS、六类数据及三独立浏览器会话验收；账号密码由 GitHub Secrets 提供，没有写入前端或归档。结果见[真实后端报告](live-backend-results.md)。

迁移只新增同步表和一个 RPC，不改变图库或作品架结构。表启用并强制 RLS；认证用户只能 SELECT 自己的 `owner_id`。匿名读取/写入和前端直接写入全部撤销；唯一写入口从 `auth.uid()` 决定所有者，不接受用户指定 owner，使用修订检查和每用户事务锁执行原容量限制。不得给匿名或认证用户补授直接 UPDATE / INSERT 权限。

回滚见 `supabase/migrations/20261114_device_sync.rollback.sql`。先让访客关闭同步，再移除 RPC 和新表；该脚本会删除云端同步记录，执行前如需保留，应由站主在数据库另行归档。不会删除浏览器作品或图库。

服务端每用户最多 6500 条含删除标记记录，避免无限增长。删除标记不自动过期，以免长时间离线的设备复活旧数据；达到上限后需站主制定保留策略并通知旧设备重新连接，前端会显示失败并保留本机。没有把同步包装为全站备份导入导出，也没有调整作品架容量。

## 验证命令

```sh
node tests/sync-core.test.js
node tests/device-build.test.js
VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= GITHUB_SHA=offline-before npm run build -- --outDir /tmp/hitori-device-dist
VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= GITHUB_SHA=offline-after npm run build -- --outDir /tmp/hitori-device-update
python tests/browser-device-offline.py --dist /tmp/hitori-device-dist --update-dist /tmp/hitori-device-update
```

Node 逻辑测试覆盖空设备合并、远端新修改、删除与编辑冲突、草稿冲突、收藏删除、最高分合并、坏数据拒绝、账号切换阻止、原容量、当前计时器保留。离线浏览器测试使用真实生产构建和 Chromium 的断网模式，未模拟 Supabase。

真实后端验收脚本 `tests/sync-live-policy.mjs` 只可用专用测试账号运行，并固定核对已授权A身份。首次要求为空；重跑只允许已知测试ID的删除标记，任何活动或未知记录均拒绝写入。验证 A/B/匿名隔离、拒绝直接修改、CAS 冲突、幂等、墓碑、作品版本和六类数据。仅在明确设置 `HITORI_SYNC_TEST_ALLOW_WRITES=yes-isolated-accounts` 后写入；不自动申请邮箱、不使用正式站主会话。所需环境变量：

- `HITORI_SYNC_TEST_URL`、`HITORI_SYNC_TEST_PUBLIC_KEY`
- `HITORI_SYNC_TEST_A_EMAIL`、`HITORI_SYNC_TEST_A_PASSWORD`
- `HITORI_SYNC_TEST_B_EMAIL`、`HITORI_SYNC_TEST_B_PASSWORD`

运行 `node tests/sync-live-policy.mjs`。缺配置时退出码 2，并明确表示未验证。测试后两个账号只有专用测试删除标记，站主可在 Supabase Auth 删除专用账号连带清理；不应对普通用户运行此脚本。

## 站主维护

新增可离线玩法时，在 `scripts/device-build.mjs` 的 `choices` 中登记组件和必要素材，并实际断网验证；不要把整个 public 目录或全部图库加入缓存。模板、人物素材变更会生成新的代码版本；公开素材如使用固定 URL，更新时也会重新下载所选资源。

同步状态、最近成功时间、待发送数量和冲突处理均在设备页面。离线失败不会清空作品或草稿；权限、容量和网络失败显示真实错误，重试仍使用修订检查。

## 本次实际结果

- `tests/sync-core.test.js`：16 项通过；新增覆盖首次同编号作品遇远端删除标记时保留冲突、相同快照但不同 ID/标题/标签/置顶的版本分别保留、满作品架先提交删除再新增。
- `tests/draft-persistence.test.js`：8 项通过；覆盖 Vue 代理、外部草稿接收后不被卸载覆盖、错过 storage 事件时的同步写保护、真正未保存的并发草稿两份保留、账号切换空草稿使用工具默认值、存储受限、编辑暂时无效输入、旧游戏运行态原始存盘兼容。
- `tests/device-build.test.js`：3 项通过；验证静态依赖/CSS 图，不默认下载动态图库，资源清理不触碰用户数据，固定 URL 人物素材实际字节与原 HTML 改变都会生成新版本指纹。
- `tests/browser-device-offline.py` 在真实 Chromium 运行通过。明确使用空 Supabase 配置构建了两个不同 `GITHUB_SHA` 的生产产物；选择拍贴、编曲、练琴与节奏，实际缓存 74 个必要资源，确认没有缓存图库图片或 WAV/MP4；实际断网后四种工具均可完整重载，拍贴可继续编辑/自动保存/再次刷新。
- 原生草稿冲突对话框在手机全屏编辑中正确位于顶层，使底层编辑区域不可操作；Esc 不会丢稿或退出编辑器，选择后恢复焦点，未保存本机稿和新收到稿不会被旧卸载写覆盖。
- 新生产构建的 Worker 先缓存已选玩法，等待明确更新操作后接管并刷新；更新后重新断网打开拍贴，先前草稿仍保留。清理离线资源后草稿保留；强制发起新的离线导航得到基础离线页面。
- 浏览器 `pageerror` 记录为空。报告：`evidence/device/offline-report.json`；截图：`device-mobile.png`、`device-desktop.png`、`photobooth-offline-mobile.png`、`draft-conflict-fullscreen-mobile.png`。

以上为本机逻辑与离线验证，没有模拟生产 RLS 成功。后续已另完成真实同步权限及多设备账号流程，记录在[真实验收报告](live-backend-results.md)，与这些本地结果分开。

独立复核还固化了 `tests/sync-account-race.test.js`（隔离 VM 运行真实 `cloudSync.js`，无后端）：旧 generation、获取 client、获取 session、收到 fetch 响应、计算内容描述五个异步边界切换账号后，A 的持久状态、B 的持久状态和 B 内存状态均未被旧请求污染。与本模块其余三份测试合计 **28 项通过**。受当前检查环境的子进程限制，该测试需在允许 Node 子进程的执行环境运行；限制本身不是网站故障。

独立真实浏览器复核 `tests/browser-sync-drafts.py` 的 8 项检查通过，包含双真实标签页的原生 storage 事件、拍贴和独立编曲编辑器采用新稿、账号切换空草稿的默认值、真正同时修改的可导出原生冲突对话框，以及离开页面不会回写旧稿。报告为 `evidence/sync-review/browser-results.json`；仍属于本地生产前端验证，未声称真实后端权限通过。

额外数据库验证：`tests/sync-policy-check.mjs` 在隔离 PostgreSQL/PGlite 实际执行迁移和回滚，8组通过，涵盖匿名拒绝、A/B账号隔离、禁止直接写、修订CAS/幂等、墓碑、满24版先删再增、3MiB限制及回滚保留图库。结果 `evidence/sync-review/database-results.json`。使用 `HITORI_PGLITE_MODULE=/tmp/hitori-gallery-sql-check/node_modules/@electric-sql/pglite/dist/index.js node tests/sync-policy-check.mjs` 复核；引擎和Auth测试schema仅在本地新建，不连接生产。这仍不替代真实 Supabase Auth / 网络双设备验收。

最终素材复核修正了房间布置、涂鸦和散步的独立离线角色依赖：三组现在分别包含四位成员的必要人物素材，而不是依赖用户同时选择拍贴。PWA 依赖图测试逐组断言 `artwork.webp` 必须存在。

扩展后的真实 Chromium 离线脚本另建 **三个全新、互相隔离的 BrowserContext**，每个只选上述一种玩法；确认未缓存拍贴组件，再实际断网打开。三组均成功解码四位成员的原始尺寸图；房间中的人物 SVG 正常显示，涂鸦实际盖下四枚角色印章并检测到 **87531 个不同于纸张底色的画布像素**，散步遍历六站后四位角色图片均解码成功。原四工具、更新、冲突与清理流程也全部重跑通过，页面异常记录仍为空。

新增截图：`evidence/device/decorate-isolated-offline-mobile.png`、`graffiti-isolated-offline-mobile.png`、`walk-isolated-offline-mobile.png`。完整结果位于同目录 `offline-report.json` 的 `isolatedArtworkTools` 字段。这些数字仅描述实际文件尺寸和测试画布像素，不代表性能提升。

配置态离线也单独验证通过：`tests/browser-device-configured-offline.py` 使用有效格式的独立 Supabase fixture 公开配置构建（并拦截外部服务请求，未模拟后端成功）。从活动室开始，只经真实 Worker 缓存选择功能下载散步；确认 Auth SDK 既未被访问也未进入 CacheStorage，然后实际断网、强制新文档打开设备页。已下载入口、缓存控制与登录范围说明均可见，没有触发应用恢复页；恢复联网后，提前注册的 online 监听会重新初始化并实际下载 SDK。3 项浏览器检查通过，页面异常为空。截图和报告分别为 `evidence/device/configured-offline-settings-mobile.png`、`configured-offline-report.json`。

对应实现使同步初始化失败与离线缓存读取分别处理；即使同步依赖未下载或服务不可用，也不会阻断本机设备页。重现命令：

```sh
VITE_SUPABASE_URL=https://device-fixture.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_device_offline_fixture GITHUB_SHA=device-configured-offline npm run build -- --outDir /tmp/hitori-device-configured
python tests/browser-device-configured-offline.py --dist /tmp/hitori-device-configured
```
