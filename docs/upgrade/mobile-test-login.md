# 手机配置真实验收账号

手机无需打开云端的 /workspace 文件。可在 GitHub 仓库的加密 Actions Secrets 中填写，测试流程从服务器取用，不通过聊天传密码，也不进入前端构建。

打开： https://github.com/Hitori-Gotou1/patrol-retest-demo/settings/secrets/actions

选择 New repository secret，分别保存四项：

| Name | Secret |
|---|---|
| HITORI_SYNC_TEST_A_EMAIL | 新测试账号A邮箱 |
| HITORI_SYNC_TEST_A_PASSWORD | 新测试账号A密码 |
| HITORI_SYNC_TEST_B_EMAIL | 新测试账号B邮箱 |
| HITORI_SYNC_TEST_B_PASSWORD | 新测试账号B密码 |

URL/公开key沿用现有Actions Variables，无需再次发送。测试账号应为此前新建的空账号，A加入图库白名单，B保持普通用户。

工作区已准备验收job：现有deploy.yml仅在codex/backend-acceptance前缀的测试分支被手动触发时读取这四项Secrets，最小contents:read权限。生产部署仍要求main，因此该分支不会部署网站；测试分支的并发组也与生产分开。没有改动生产发布授权范围。

四项 Secrets 已由站主保存，独立分支已执行真实账号检查。首次 Auth/RLS/修订/幂等检查已通过：[Actions 43663337654](https://github.com/Hitori-Gotou1/patrol-retest-demo/actions/runs/43663337654)。后续完整真实上传与多设备流程见[交付说明](delivery.md)。测试只写入本次生成的图库资源和专用同步记录；图库资源精确清理，同步保留删除标记以验证旧请求不会复活内容，不读取或修改原用户数据。
