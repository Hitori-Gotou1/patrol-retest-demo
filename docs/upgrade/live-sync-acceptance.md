# 真实后端浏览器同步验收

脚本：`tests/browser-sync-live.py`。它调用真实 Supabase Auth、真实同步表/RPC及浏览器界面，不拦截或模拟服务成功；不会发布网站，也不会修改工作流。

## CI 输入和命令契约

必需环境变量与 `tests/sync-live-policy.mjs` 一致：

|变量|来源及用途|
|---|---|
|`HITORI_SYNC_TEST_URL`|已迁移的真实 Supabase HTTPS 项目根地址|
|`HITORI_SYNC_TEST_PUBLIC_KEY`|同项目公开 publishable / legacy anon key，禁止管理密钥|
|`HITORI_SYNC_TEST_A_EMAIL`、`HITORI_SYNC_TEST_A_PASSWORD`|GitHub Secrets 中的专用账号 A|
|`HITORI_SYNC_TEST_B_EMAIL`、`HITORI_SYNC_TEST_B_PASSWORD`|GitHub Secrets 中的另一个专用账号 B|
|`HITORI_SYNC_TEST_ALLOW_WRITES`|必须明确设置为 `yes-isolated-accounts`|
|`HITORI_SYNC_TEST_EXPECTED_A_UID`|可省略；默认核对用户指定的 `f72aa1d6-393d-4a6a-a0e0-709537ed170a`|

生产构建须使用相同项目的 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_PUBLISHABLE_KEY`。账号密码只使用 `HITORI_` 环境变量，不能加 `VITE_` 前缀或写入产物。脚本会核对实际构建文件包含预期公开连接，再尝试真实登录。

在已安装 Playwright Chromium 的 CI 中执行：

```sh
npm run build -- --outDir /tmp/hitori-live-sync-dist
node tests/sync-live-policy.mjs
python tests/browser-sync-live.py --dist /tmp/hitori-live-sync-dist --output /tmp/hitori-backend-live/sync
```

构建时将上述两项 `VITE_` 公开变量映射到真实项目；测试时注入四项 Secrets 和其余 `HITORI_` 变量。不要通过带值的 shell 命令、`set -x` 或打印环境诊断传递凭据。Node 与浏览器同步验收应顺序运行；图库验收如共用账号，也不能全局撤销该账号的其他会话。

可选 `HITORI_CHROMIUM` 指定已安装浏览器的绝对路径；未设置时优先使用 `/usr/bin/chromium`，否则使用 Playwright 管理的 Chromium。`--timeout-ms` 默认 60000。脚本自带本地 HTTP server，挂载路径与 Pages 一致，无需另起 Vite 服务。浏览器使用本地产物，后端使用真实项目。

## 账号与数据保护

开始前必须通过真实 Auth 验证：A UID 与预期一致，B 是另一个账号。脚本读取两个账号自己的同步记录，仅允许 `deleted:true`、`payload:null` 的已知测试删除标记；任何活动记录、未知类型或未知 ID 都会停止测试，且不改动内容。

允许保留的既有测试删除标记：

- `favorite:test-UUID`、`favorite:quiet-guitar`
- `activity:photobooth`
- `draft:studio`、`draft:photobooth`
- `work:test-work-UUID`、`work:13位时间戳-[a-z0-9]{1,12}`、`work:sync-UUID`
- `practice:test-practice-UUID`
- `rhythm:easy`

这与真实 Node policy 验收共享约定。原有删除标记不扫描删除。重跑时若新编辑的拍贴与旧删除标记冲突，脚本通过真实界面明确点「保留本机」，继续遵循修订检查；图片与活动收藏在初次合并完成后再实际点击添加，使其成为有共同基线的新操作。

本次 UI 精确操作 A 的 `draft:photobooth`、`favorite:quiet-guitar`、`activity:photobooth`，并创建两个真实作品版本：初存的标准时间戳 ID，以及冲突时另存的 `sync-UUID`。作品和草稿的内容带随机 `LIVE-8hex` 标记。B 只验证自己的空范围及权限，不创建业务记录。

`finally` 先关闭浏览器，再用真实 RPC 对本次创建或明确修改的精确 key 写删除标记。请求携带当前修订号；有并发修订时仅在内容仍完全相同时重试。若界面已创建作品但等待后续断言失败，清理仅接纳新出现且内容包含本次随机标记的作品 ID。未知记录、其他随机标记或发生内容变化的记录均不自动清理。既有无关删除标记的全部字段必须保持不变；重用的专用测试 key 最终回到删除标记。清理失败将令测试失败并保留明确报告，不假装成功。

## 实际覆盖

三个独立 BrowserContext 表示桌面 A1、手机 A2、平板 B。登录、主动查看合并预览、启用同步、拍贴编辑、保存作品、收藏静态图片、加入常用活动、同步重试与冲突选择均通过网站真实界面完成。

验收内容：

1. A1 创建拍贴作品与草稿，主动登录并合并到真实后端。
2. A1 在界面收藏静态 `quiet-guitar`、将拍贴加入常用；直接只读核对真实云端结果。
3. A2 独立登录、主动合并后获得同一个作品 ID、草稿、图片收藏及常用活动。
4. B 的个人范围保持为空，使用 B 的真实令牌读取 A 的 owner 范围不可得到数据。
5. A2 真正断网修改草稿；本机 outbox 有记录、真实服务器未变；联网后界面重试同步，A1 收到修改。
6. A1/A2 从同一修订出发，分别断网修改；先恢复 A1，再恢复 A2，真实同步产生草稿冲突。
7. A2 通过「保留本机，云端另存版本」同时保留两份编辑；两台 A 设备最终拥有相同的两个作品版本。
8. B 在所有修改后仍隔离；仅对作品、拍贴或冲突区域截图。

报告目录默认 `evidence/backend-live/sync`，可通过 `--output` 或 `HITORI_LIVE_OUTPUT` 指定。CI 推荐上传 `/tmp/hitori-backend-live/sync`，包含 `browser-results.json` 及三张成功步骤截图。不会生成登录截图、失败全页截图、录像、HAR、trace、浏览器 storageState 或会话文件。报告与错误递归脱敏，不包含邮箱密码、Auth token、refresh token 或 session。

## 当前验证状态

本地没有 GitHub Secrets，因此没有执行真实后端浏览器流程。`python -m py_compile tests/browser-sync-live.py` 已通过；4 项本地安全护栏检查通过：活动数据拒绝、删除标记白名单、公开配置约束及嵌套报告脱敏。缺少凭据或未开启写入护栏时，脚本返回退出码 2，报告明确写 `NOT_RUN`，不发出后端请求。

这些本地检查只证明脚本语法和保护逻辑。真实浏览器结果仍等待专用分支 GitHub Actions 执行，不能作为生产服务已验收的证明。
