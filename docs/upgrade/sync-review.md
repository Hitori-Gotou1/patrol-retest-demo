# 同步独立审查记录

2026-11-14，对 `syncCore.js`、`syncStorage.js`、`cloudSync.js` 及 `20261114_device_sync.sql` 做独立只读审查。以下五项先用实际源码或本地 Chromium 复现，随后已独立复核修复并通过本机回归。本记录不代表真实 Supabase 验收。审查者未修改被审查业务文件，未访问用户生产数据。

1. **首次连接的创作内容与云端删除冲突**：`reconcileRecord({local:{payload:本机新内容}, remote:{space:'work',entity_id:'a',revision:3,deleted:true,payload:null},firstConnection:true})` 原返回 `pull`，导致没有共同基线的本机作品被删除。作品/草稿/日志应要求明确冲突选择；收藏和常用活动可采用删除优先。
2. **不同 ID 的同画面版本丢失**：用两份合法拍贴记录（不同 id/title/tags/pinned，同 snapshot）传入 `stageSyncSnapshot`，原只剩第一个。原因是备份导入 `importWorks` 的内容去重不适合按记录 ID 同步。同步必须保留独立版本并继续执行既有 24 个 / 3 MiB 约束。
3. **活动编辑器离开时覆盖同步来的草稿**：真实 Chromium 打开拍贴并保存 A；写入新草稿 B，同时发送 `storage` 与 `hitori:sync-applied`；当时存储 B、编辑器仍 A；离开页面后 `useLocalDraft` 卸载持久化使存储回到 A。原始结果：`{"beforeLeaving":{"stored":"同步接收的新草稿B","editor":"本机打开的旧草稿A"},"afterLeaving":"本机打开的旧草稿A"}`。其他直接存储编辑器也需统一响应外部替换，防止切账号后旧标签的旧草稿污染新账号。
4. **满额时正常替换无法同步**：当前键遍历实测生成 `[{key:'work:new',deleted:false},{key:'work:old',deleted:true}]`。云端已有 24 版、本机移走 1 版再新增 1 版时，最终合并仍 24 版，前端 staging 通过，但新增先执行触发 SQL 容量限制，删除无法执行，重试顺序相同。须先处理删除或使用原子批次。
5. **账号切换后的迟到提交污染本机同步状态**：以实际 `cloudSync.js` 源码在 VM 内注入无网络认证客户端，导出内部函数用于观察。执行 A→B 的 `acceptUser`，再运行 A 的旧 generation `putRecord`。原函数最终拒绝“账号已变化”，但检查前已经对 B 的全局 accountState 修改并用 A 的 uid 持久化。实测 A 持久 base 含 B 的 `work:private-b`，B 内存 outbox 含 A 的 `favorite:private-a`。所有异步状态写入应绑定本次账号、generation 和 accountState，先检查再写入，尤其关注 reconcile、put、最终 hash/describe 的 await 边界。

权限 SQL 的静态审查确认：表开启并强制 RLS；匿名无表读写或 RPC 执行权限；认证用户仅自有 SELECT；所有写入由 SECURITY DEFINER RPC 从 `auth.uid()` 决定 owner_id；修订 CAS、幂等 operation 与逐用户事务锁存在。真实服务部署、隔离测试账号权限、跨设备网络联调仍须单独执行，不能以此静态审查或本地 fixture 冒充。

## 修复后的独立复核结果

2026-11-14 再次使用当前源码与独立生产构建 `/tmp/hitori-sync-review-dist` 验证。上述五项代码缺陷在本机回归范围内均已关闭：

| 原问题 | 修复及实测依据 | 结果 |
|---|---|---|
|1 首次连接创作对删除标记丢稿|`sync-core.test.js` 实际核对 work/draft/practice 均返回 conflict，书签仍保留删除策略|通过|
|2 同画面不同 ID 版本丢失|staging 直接校验每个作品 ID，实测两个相同 snapshot 的独立标题、标签、置顶均保留；第 25 版仍拒绝且不改原存储|通过|
|3 活动编辑器卸载回写旧稿|真实 Chromium 原 A/B 复现关闭：收到 B 后编辑器同步变 B，离开后存储仍 B；两个真实标签的原生 storage 事件也通过|通过|
|4 满额替换提交顺序|`orderSyncPlans` 测试确认墓碑在新增版本之前；客户端 staging 仍执行 24 版 / 3 MiB，未扩容|通过（本机逻辑）|
|5 账号切换迟到状态污染|实际 cloudSync 源码在隔离 VM 的五个边界切换账号：旧 generation、等待 client、等待 session、等待响应、等待内容 hash；逐次断言 A 持久状态、B 持久状态与 B 内存状态均不被迟到结果污染|通过|

另外验证账号切换后的空草稿使用工具默认，不重新使用旧账号内容；拍贴与独立编曲均通过。真正未持久化的同时修改会出现原生冲突弹窗：当前内容可导出为实际 JSON，新稿留在存储中；选择新稿后可正常退出。跨账号冲突不提供直接把旧稿写入新账号的按钮。移动端弹窗截图已实际打开检查。

执行结果：

- `node --test tests/sync-account-race.test.js tests/sync-core.test.js tests/draft-persistence.test.js`：24 项通过，其中 VM 套件内部覆盖 5 个账号切换边界。默认执行沙箱会阻止 Node 子进程，因此本次通过环境许可在沙箱外运行，未增加网络访问或真实服务写入。
- `tests/browser-sync-drafts.py --dist /tmp/hitori-sync-review-dist`：真实 Chromium 8 项检查通过，无未捕获页面异常。
- `evidence/sync-review/account-race-results.json`：五边界结果。
- `evidence/sync-review/browser-results.json`：浏览器结果。
- `evidence/sync-review/draft-conflict-mobile.png`：390px 冲突弹窗。
- `evidence/sync-review/unsaved-current-draft.json`：真实导出并读回的本机未保存草稿，仅本地合成测试数据。

本轮未连接真实 Supabase、未执行数据库迁移、未以真实隔离账号做远端权限或完整双设备联调；数据库权限与网络重试的真实服务验收继续按 `offline-sync.md` 列出的配置和测试完成。CAS 与满额替换的远端事务行为仍属于此验收范围，不能用以上 Node、VM 或本机浏览器结果代替。
