# 图库升级与站主操作

本模块覆盖 7、9、15、16、17。原图 ID、现有收藏和 Hash 分享链接保持原样；未重标旧收藏，未补写作者或来源。此前 `gallery.sql` 保留。

## 数据与权限

部署新前端前，以 Supabase 项目管理员身份依次执行首次接入所需的 `supabase/gallery.sql`（已执行过不需重复）与可重复执行的升级 `supabase/gallery-upgrade.sql`。升级增加 `preview_path`、可空 `characters`、`category`、`tags`、`creator`、`source_url`、`published`、`sort_order`、`content_sha256`、`updated_at`。旧图的 `characters = null` 仍走原文字识别；新上传用显式数组（可为空）。分类以校验过的 token 存储，现有选择为站主收藏、同人插画、设计海报；后续扩展在 `galleryMetadata.js` 增加显示标签，不需重写历史记录。

数据库 RLS 允许匿名读取展示中的记录；只有白名单站主可以创建、读取自己的下架图与编辑自己的图。更新权限仅授予元数据列，触发器进一步禁止修改图片 ID、所属用户、资源路径和内容指纹。图片下架移出公开列表，不删除文件；原先的公开原图 URL 依然可以访问，不能将下架当作撤回公开文件。

`gallery_collections` / `gallery_collection_items` 保存多对多策展关系。`gallery_save_collection` 使用 SECURITY INVOKER，在数据库事务内更新合集和成员，继续受调用者 RLS 约束；失败不会留下半份成员列表。静态 ID 与 `cloud-UUID` 使用相同图片编号格式，不修改原始图片。

回滚：先回退前端，再按 `supabase/gallery-upgrade-rollback.sql` 执行。它保留所有原图记录和存储对象，但会删除新元数据及合集，因此先保留数据库快照。回滚恢复旧版全部公开读取行为，已下架记录会再次展示。预览衍生文件不自动删除，避免破坏仍打开着的旧标签页。

## 图片与队列

入口 `/#/manage-gallery`，使用既有站主邮箱密码登录。

1. **批量上传**：多选或拖入 JPG/PNG/WebP，每张沿用 10 MiB、4000 万像素上限，每次最多加入 50 张。先校验文件签名并计算 SHA-256，识别队列内和云端重复内容，不根据文件名判断。可逐图展开信息，或将分类、角色、标签及作者来源批量应用到等待中的任务。标题、描述不批量覆盖。
2. **开始发布**：手机最多一张、其他设备最多两张同时压缩上传；任务逐张显示准备、上传和发布状态。未开始的任务可取消，失败可单独重试。刷新、离开、退出时提示未完成任务。队列中的文件不会保存在浏览器长期存储，离开后需重新选择。
3. **预览**：原图原样保留；另生成最长边 640px 列表图、1920px 适屏图，均不放大小图。1920px 以内的图片直接复用原图作为预览。JPEG 使用 JPEG；PNG/WebP 的衍生图使用保留透明通道的 WebP（浏览器不支持时接受实际返回的 PNG）。使用解码后的方向与比例。列表与弹窗由图库读取器分别选择缩略图、预览，用户主动打开原图。
4. **发布失败**：重试复用任务编号；数据库提交响应丢失时先查询同一编号，确认已发布则返回成功。每次尝试生成新的资源 UUID，只清理该次尝试过的独立资源路径（包括存储响应丢失的路径）；提交结果无法确认时保留文件并明确提示核查，避免误删已经发布的资源。
5. **已发布图片**：搜索、分类、展示状态与每页 12 张分页；编辑标题、描述、作者/来源、网址、角色、分类、标签及排序值。小数字靠前。下架/恢复保留图片 ID、收藏与分享链接。仓库静态图仅提示到仓库维护，没有无效管理按钮。

标签最多 8 个，每个 1–20 字；标题、描述、作者、来源等前后端均有长度限制。浏览器只接收公开 Supabase URL / publishable key；白名单与服务管理密钥不在前端。

## 合集维护

在管理页切换「主题合集」，新建标题、简介，按展示顺序输入图片编号；可选择其中一张为封面，设置公开状态及合集顺序。云端图片的完整 `cloud-UUID` 可从已发布列表选择复制。删除合集只删除组织关系，不删除图片。

公开入口 `/#/collections` 与 `/#/collections/:id`。复制分享可打开正确合集；静态策展的抓取页由站点构建生成。没有可用图片的合集显示空状态。示例 `src/data/galleryCollections.js` 只使用已确认的收藏 19、21、22：开演前、四人合照和暖光休息，保留既有来源，未编造作者。本站静态策展在该文件维护，云端策展在工作台维护。

## 验证与限制

- `node tests/gallery-management.test.js`：10 个关键逻辑测试通过，覆盖元数据边界、SHA256、失败清理、模糊提交保留资源、重试编号、字段白名单、非站主拒绝、队列并发/取消/重试、合集校验。
- `tests/gallery-policy-check.mjs`：在隔离 PostgreSQL/PGlite 真实执行原迁移、升级、回滚；覆盖匿名、普通账号、两个站主的读写隔离和资源身份保护，以及合集事务原子性。这是本地数据库权限测试，**不代表生产 Supabase 策略已部署或通过验收**。复核命令见脚本开头，测试运行时安装在 `/tmp`，未新增站点依赖。
- `tests/browser-gallery-admin-upgrade.py --dist /tmp/hitori-galleryadmin-dist`：配置为 `https://gallery-test.supabase.co` 的隔离构建，所有云端请求由 HTTP 夹具拦截。真实 Chromium 操作上传、管理、队列与合集，并检查实际 canvas 生成文件。截图与真实衍生文件保存在 `evidence/gallery-admin/`。

已用线上公开连接只读确认：生产当前仍为旧结构，`preview_path` 缺失（42703），`gallery_collections` 未创建（PGRST205），因此新管理与合集后端尚未部署。真实服务尚缺：执行升级迁移的项目管理权限、两个隔离测试账号（站主白名单账号/普通账号）与授权的测试图片空间。未向生产写入任何图片或合集，未将合同夹具或本地 PostgreSQL 测试描述成生产验证。

### 旧验收入口与恢复回归

旧 `tests/browser-upload.py` 已迁移为新队列验收的兼容入口，单文件表单不再存在。使用同一约定执行：

```sh
VITE_SUPABASE_URL=https://gallery-test.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_gallery_upgrade npm run build -- --outDir /tmp/hitori-galleryadmin-dist
python tests/browser-upload.py --dist /tmp/hitori-galleryadmin-dist
HITORI_CHROMIUM_EXECUTABLE=/usr/bin/chromium HITORI_CLOUD_OUTPUT=evidence/gallery-admin/cloud-recovery python tests/browser-cloud-recovery.py --dist /tmp/hitori-galleryadmin-dist
```

上传兼容入口已实际执行通过；其所有网络请求只放行临时本机服务器与 `gallery-test.supabase.co` 夹具，拒绝其他目的地，避免误将生产构建用作写入测试。旧 `HITORI_UPLOAD_QA_URL` 约定由 `--dist` 取代，测试自行启动本机服务器。

云端恢复回归保留了 SDK 加载超时、过期会话刷新、权限检查超时、认证服务失败、登录超时、图库断线恢复与 HTTP 错误七组用例，并新增旧数据库结构返回 42703 时的读取与单图分享定位。新增用例实际发现并修复并发兼容竞态：首批列表和单图定位同时失败时，后一个响应会因为共享模式已被修改而漏掉兼容重试；现按每次请求实际使用的结构决定重试。结果记录在 `evidence/gallery-admin/cloud-recovery/results.json`，仍仅代表隔离 HTTP 合同验证。

## 2026-11-14 执行进度与重复运行修复

用户在SQL Editor遇到42710：`gallery_preview_owner_folder already exists`。原脚本虽对列使用IF NOT EXISTS，约束、索引、触发器和策略却没有完整处理重复执行；现在已补齐，保留原记录与合集。约束按目标表/名称判断，表与索引用IF NOT EXISTS，命名触发器/策略在同一事务中重新建立。

隔离PostgreSQL验收扩至10组：除原权限/事务/回滚外，对已填有图片、标签、下架状态、合集成员、白名单和存储对象的数据库连续重跑两次，逐行内容不变且RLS仍有效；另复现仅有preview列及同名约束的部分安装状态，升级成功，路径穿越仍被约束拒绝。

随后真实匿名GET只读复核：新增图库字段、gallery_collections和gallery_collection_items均200，说明这些结构已经建立；hitori_sync_records仍404/PGRST205。证据 `evidence/backend-migration-progress.json`。这是结构可读取的确认，真实管理写入及账号隔离验收仍待专用账号，不等同于生产权限已完整验证。
