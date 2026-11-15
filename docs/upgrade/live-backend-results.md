# 真实 Supabase 验收结果

2026-11-15，[Actions 43664537700](https://github.com/Hitori-Gotou1/patrol-retest-demo/actions/runs/43664537700) 全部通过。验收源码 `fcff04eb6f644f05c4ee6a2c616ff5aaaf3adbfb`，分支 `codex/backend-acceptance`。后续提交仅整理交付文档。主分支未合并，Pages 的 configure/upload/deploy 均跳过。

|检查|结果|实际覆盖|
|---|---|---|
|生产构建与路由|通过|195项Node测试；未配置、登录态入口、真实公开配置三种构建与路由|
|原图库回归|通过|素材/导入、灯箱、收藏搜索分享、云端失败和会话恢复|
|原活动室回归|通过|room、playroom、adventures、playground、experience、expansion|
|真实图库策略|10项通过|Auth身份、站主白名单、Storage上传与下载、显式资料编辑、非站主/匿名隔离、合集多对多/顺序/事务回滚、公开读取和写入拒绝|
|真实图库网页|8项通过|390px手机多选两图、角色/分类/标签、逐张上传、1920px透明预览/640px缩略图、搜索编辑排序/上下架、桌面合集及普通账号拒绝|
|真实同步策略|7项通过|Auth隔离、禁止直接写、CAS/幂等、墓碑、独立作品版本、旧/新编曲、草稿/收藏/常用/练琴/节奏六类数据|
|真实同步网页|8项通过|三个独立浏览器会话；A1→A2作品与收藏、断网改稿与恢复、双方改稿冲突并保留两份、B隔离|

图库的真实测试资源全部按新生成的 UUID 与专用 owner 精确清理，数据库与Storage查无残留。同步真实策略清理8个测试实体，浏览器清理5个本次实体；删除标记保留，以维持旧请求不会复活记录的语义。以前的无关测试删除标记未改变。没有批量删除、重标、修改原图片/合集/用户作品。

后端使用项目原有公开连接和两个隔离账号，密码来自GitHub Secrets；没有服务端管理密钥，没有借用正式站主会话。前端构建仅接收公开变量。验收未使用模拟服务响应，浏览器视口模拟手机/平板，未声称物理设备验收。

原始报告位于 `evidence/live-backend/full-43664537700/`：

- [图库策略](../../evidence/live-backend/full-43664537700/gallery-policy/gallery-live-policy.json)
- [图库网页](../../evidence/live-backend/full-43664537700/gallery-browser/browser-gallery-live.json)
- [同步策略](../../evidence/live-backend/full-43664537700/sync-policy/sync-live-policy.json)
- [同步网页](../../evidence/live-backend/full-43664537700/sync-browser/browser-results.json)
- [手机上传](../../evidence/live-backend/full-43664537700/gallery-browser/gallery-live-upload-mobile.png) / [手机工作台](../../evidence/live-backend/full-43664537700/gallery-browser/gallery-live-workbench-mobile.png)
- [桌面合集](../../evidence/live-backend/full-43664537700/gallery-browser/gallery-live-collections-desktop.png)
- [手机草稿冲突](../../evidence/live-backend/full-43664537700/sync-browser/live-draft-conflict-mobile.png) / [最终拍贴](../../evidence/live-backend/full-43664537700/sync-browser/live-synced-photo-mobile.png)
- [桌面两份作品版本](../../evidence/live-backend/full-43664537700/sync-browser/live-synced-work-versions-desktop.png)

下载的GitHub证据ZIP已核对SHA256：`51b70f9461c7be22a1a01f999bc63f8281c0363f8e93dc15b3ac6699a2a5e4e3`。账号栏/输入框已遮罩，未生成登录截图、浏览器storageState、HAR或trace。完整日志保存在 `evidence/live-backend/full-43664537700-job.log`，GitHub同样保留执行记录。证据下载遇到检查环境对Azure直链的拦截后，改由GitHub插件下载成功；该拦截与网站或Supabase无关。

音视频与断网基础功能的真实生成文件、播放、解码、版本更新和缓存清理结果见[完整交付](delivery.md)。生产发布及发布后的线上更新检查仍待用户明确授权。
