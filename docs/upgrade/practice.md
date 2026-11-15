# 节奏、练琴与伙伴手帐（24、25、26）

## 用户可见行为

- **24 节奏**：展开「校准与键位」可跟随八拍闪光/声音轻点或按空格，采集至少四次后使用中位数估计输入补偿；用户确认「应用本次校准」后才生效。支持 −300～300ms 手动微调、重置和四个互不重复的字母/数字键。触控使用 pointerdown，保留键盘、暂停、难度与最高分。完成后显示早按/晚按/落点附近、平均偏差及五档分布；±15ms 仅用于复盘分类，原 Perfect/Great/Good 判断窗不变。文案说明设备与蓝牙延迟会影响结果，不把偏差解释为能力。
- **25 练琴**：开始前填写曲目与目标；正常完成后可补心得。提前结束先暂停并展示计划/实际时间，用户选择按实际秒数保存、放弃记录或继续。周/月趋势按设备本地日期汇总，近十五次可直接查看与补心得。历史独立 JSON 仍可读，独立导出包含新增字段；仍保留最近365条明细和原累计统计。
- **26 手帐**：原最近八件记忆之外，追加最多180页长期手帐；按日期翻看、只看夹星、关联本机作品、返回对应活动、删除单页。关联作品可继续编辑（沿用作品架恢复前保护草稿的行为）；作品不存在时显示原名称与说明。四位伙伴保存当时各自的原创回应，页面明确标注不是官方台词。整理上限时先保留夹星旧页，再保留其余近期页。

## 数据与兼容

- `hitori-room:rhythm-best:v1` 不变；新增 `hitori-room:rhythm-preferences:v1`，`{version:1, offsetMs, keys:[...]}`，键位归一为小写并去重校验。改变设置不会重写最高分。
- `hitori-room:practice:v1` 与版本1不变；旧记录 `minutes` 推导为 `actualSeconds`、`plannedMinutes`。新增 `track`（80字）、`goal`（120字）、`reflection`（240字）、`endedEarly`，累计新增精确 `totalSeconds`，原 `totalMinutes` 为整分钟。正在计时状态仍按 deadline/remaining 恢复，暂停时间不计入。
- 所有练琴读改写通过 `practiceTransaction`：有 Web Locks 时跨标签串行化且写入前读取最新数据；不支持时使用短期存储租约和有限重试。完成记录按会话ID去重，旧数据无法读取时保留原字符串并报错。存储禁用时明确提示本页内存计时与离开前导出，不冒充已保存。
- `hitori-room:companion:v1` 与版本1不变；旧近期记忆自动作为已有手帐页继承，不修改来源资料。新增 `diary`（180条）与 `diaryDeleted`（最多240个已删ID，阻止近期活动补读时复活）。手帐页保存活动、时间、当时成员/回应、夹星和可选作品ID/名称，不复制作品数据，也不扩大作品架容量。
- 跨标签 storage 与同步完成事件会刷新当前界面；练琴同步应只合并已完成记录，保留本机当前计时（已与同步模块负责人约定）。本模块不新增统一备份、存储扩容或批量来源整理。

## 验证

2026-11-14 已执行：

1. `node --test tests/practice-companion-upgrade.test.js tests/room-core.test.js tests/adventures.test.js` 通过。新增8组关键用例覆盖中位校准、键位冲突、补偿判断与分布边界、实际时长/暂停/去重、旧JSON、趋势、两标签事务、手帐上限/迁移/关联/删除。
2. `npm run build -- --outDir /tmp/hitori-practice-build` 成功。存在全项目既有/其他模块的 JSON 导入属性及共享动态导入提示；未发生构建错误。
3. 真实 Chromium `python tests/browser-practice-upgrade.py` 通过。隔离本机浏览器、没有生产账号或后端数据操作。实际点击八拍校准、拒绝重复键位、保存约15秒提前练习与心得、30天趋势、两个标签页共享一轮并仅记账一次、手帐夹星与删除刷新后不复活、减少动态效果。
4. 1440×1000、375×812、430×932、768×1024 检查 rhythm/practice/companion 页面无文档横向溢出；节奏按钮宽高均≥44 CSS px；零 pageerror。截图与结果保存在 `evidence/practice/`。校准结果只是自动化输入该次实测值，不是设备性能结论。

复测：先构建，按站点 base 在本机静态服务上托管；`HITORI_QA_URL=http://127.0.0.1:端口/patrol-retest-demo/ HITORI_QA_OUTPUT=/tmp/hitori-practice-qa python tests/browser-practice-upgrade.py`。使用已有 Chromium。尚未在真实 iOS Safari/Firefox 与蓝牙耳机上硬件实测。

额外复测原有 `tests/browser-room.py --case practice` 与 `--case rhythm` 均 PASS（模拟时钟、后台暂停与恢复、最高分、独立 JSON 导出；pageErrors/externalRequests/missingAssets 均为空）。复测期间发现 Web Locks 的异步回调会延迟测试时钟的开始点，现已将开始、暂停与继续的时间固定为用户点击时刻后再加锁；原有与新增浏览器验收已再次通过。结果见 `evidence/practice/legacy-practice.json` 与 `legacy-rhythm.json`。
