# 站主上传收藏：首次配置

现有 GitHub Pages 继续托管网站和已有素材。Supabase 提供站主登录、新图片存储与收藏目录；新上传的图片直接加入公开收藏，不需要每张图片都修改 GitHub 文件。已有 54 张本地收藏保持原样。

当前代码已提供接入逻辑，**尚未创建或连接真实 Supabase 项目**。首次配置完成后，还需要实际验证登录、上传和权限。本地模拟接口测试不代表真实服务已经配置成功。

## 1. 创建 Supabase 项目

1. 在 <https://supabase.com/dashboard> 登录，创建一个项目；按页面当前提供的套餐选择，留意其存储和流量额度。
2. 设置数据库密码并自行保管。网站不需要数据库密码，也不需要 `service_role`、Secret key。
3. 等待项目初始化完成。
4. 在项目的 **Connect** 或 **Settings → API / API Keys** 中取得项目 URL 与 **Publishable key**。这两个值可以用于前端；访问限制由数据库和存储的 RLS 策略执行。

## 2. 创建表、存储桶和权限

1. 打开项目 **SQL Editor → New query**。
2. 复制仓库中的 [supabase/gallery.sql](../supabase/gallery.sql) 全部内容，执行。
3. 执行后应出现：
   - `public.gallery_admins`：站主授权名单。
   - `public.gallery_uploads`：已发布图片的目录数据。
   - Storage 中的 `gallery-uploads`：公开读取、限制写入的图片桶。
4. 不要关闭表或存储的 RLS，也不要添加“所有已登录用户都能上传”的策略。若在已有项目中配置，请检查是否存在覆盖这些对象的其他宽泛策略；PostgreSQL 的允许策略会合并生效。建议使用独立项目。

SQL 可以重复执行，不会清空已有记录或图片。它针对本项目的表、桶和命名策略配置权限；未来若修改表结构，应另写迁移，不能依赖 `create table if not exists` 改动既有字段。

## 3. 创建你自己的登录账号

1. 在 **Authentication → Users → Add user → Create new user** 中创建账号，填入你的邮箱和一个独立密码；由项目管理员创建并确认邮箱（界面可能显示 **Auto Confirm User**）。
2. 复制这个用户的 **UID / User ID**，不是邮箱。
3. 在 SQL Editor 单独执行以下语句，把示例值替换成刚复制的 UUID：

   ```sql
   insert into public.gallery_admins (user_id)
   values ('你的用户 UUID')
   on conflict (user_id) do nothing;
   ```

4. 在 Authentication 的 **Sign In / Providers → Email**（部分控制台位于 **Settings → General**）关闭 **Allow new users to sign up**，保留 Email 登录能力。网站只提供邮箱密码登录，不提供注册。
5. 只在 `gallery_admins` 中保留你自己的 UID。其他账号即便能够登录，也无法上传文件或写入收藏目录；浏览器中的“站主页面”不是权限边界，服务端 RLS 才是。

如果忘记登录密码，可以在 Supabase 管理控制台管理该站主用户；当前网站没有自助找回密码流程。不要把密码写进仓库或发给其他人。

## 4. 为 GitHub Pages 配置公开连接参数

在现有仓库 <https://github.com/Hitori-Gotou1/patrol-retest-demo> 打开：

**Settings → Secrets and variables → Actions → Variables → New repository variable**

添加两个 **Repository variables**：

| 名称 | 值 |
| --- | --- |
| `VITE_SUPABASE_URL` | 项目 URL，例如 `https://你的项目编号.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | 项目的 Publishable key，例如以 `sb_publishable_` 开头的值 |

这是前端公开连接配置，构建后会包含在网页代码里。**不要填写 Secret key、`service_role`、数据库密码或登录密码。** 项目权限不会因为使用公开 key 而绕过 RLS。

保存变量后，在 **Actions → Build and deploy Hitori Room → Run workflow → main** 重新构建部署。只保存变量不会更新已发布的静态网页。等待构建和部署均成功，再刷新网站。

本地调试时，在仓库根目录创建被 Git 忽略的 `.env.local`：

```dotenv
VITE_SUPABASE_URL=https://你的项目编号.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=你的 Publishable key
```

然后运行 `npm install`、`npm run dev`。修改环境变量后需要重启开发服务。

## 5. 上传并验收

1. 从收藏区点击「站主管理收藏」（地址为 `/#/manage-gallery`）进入上传页面，用第 3 步创建的邮箱和密码登录。
2. 选择 JPEG、PNG 或 WebP，单个文件不超过 10 MiB；按页面提示填写标题、图片说明与来源，确认后发布。
3. 回到收藏区，确认原图和缩略图加载正常，点击可以打开完整预览。
4. 使用无痕窗口或另一台设备，确认访客无需登录就能看到新图片。
5. 退出账号后确认无法继续上传。额外创建的普通测试用户，即使获得登录会话，也不应能够写入表或桶。

现有收藏仍从仓库读取；新增收藏来自 Supabase。网络故障时原有收藏仍可浏览，云端收藏暂时无法加载时页面会提示。收藏标记仍保存在每位访客自己的浏览器中。

## 数据与权限说明

- 图片桶公开读取，知道图片 URL 的访客可以直接查看图片。数据库里的每条收藏记录也公开读取，不要上传私人文件或写入私人信息。
- 上传流程先保存原图与缩略图，最后写入收藏记录；只有完整记录才出现在收藏墙。异常中断可能遗留未收录文件，可在 Storage 控制台核对清理。不要删除已有目录记录仍在引用的对象。
- 图片放在 `站主 UID/唯一文件名` 下，目录记录与文件写入都需要服务端验证站主资格。用户不能在浏览器内给自己添加站主资格。
- 当前网页没有删除已发布图片或编辑历史图片的管理界面。需要撤下时，可先在 Table Editor 删除对应 `gallery_uploads` 记录，再从 Storage 删除其 `object_path` 和 `thumbnail_path` 两个对象。不要删除整个桶。CDN、浏览器缓存和别人已下载的副本不会随删除立即消失。
- 要撤销上传权限，在 SQL Editor 删除自己的 `gallery_admins` 记录即可；公开图片不会因此消失。重新授权前应确认账号控制权。
- 定期备份 `gallery_uploads` 数据和 Storage 文件。Supabase 的免费额度、休眠与备份政策以实际套餐为准。

## 常见配置问题

- **未配置服务**：检查 GitHub Repository variables 的名称，重新运行部署；本地检查 `.env.local` 并重启。
- **邮箱密码无法登录**：确认是项目内 Authentication 用户，邮箱已确认，密码正确；数据库密码不是网站登录密码。
- **登录后没有站主权限**：检查 `gallery_admins.user_id` 是否与登录用户 UID 一致，不能填写邮箱或另一个项目的 UID。
- **上传返回权限错误**：确认 SQL 已执行，表和桶存在，授权名单正确，上传对象路径属于当前 UID。
- **访客看不到新图片**：检查元数据是否写入 `gallery_uploads`，桶是否公开，是否仍在看不同项目或旧部署版本。


## 开发验证与部署状态

两项环境变量都留空时，管理页显示未启用、静态收藏照常运行；只填写一项或误填 Secret / service_role key 时，构建会报错并停止，避免服务端密钥进入产物。不要把真实凭据当作测试值。

`npm test` 覆盖图片类型/文件头、大小与像素上限、文案长度和公开配置校验。模拟接口浏览器验证可用以下独立产物，不要将该产物部署到公网：

```bash
VITE_SUPABASE_URL=https://gallery-test.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test npm run build -- --outDir=/tmp/hitori-upload-test-dist
npm run preview -- --outDir=/tmp/hitori-upload-test-dist --port 4325
# 在另一个终端中执行，需要 Playwright Python 与 Chromium：
python tests/browser-upload.py
```

此测试拦截网络模拟上传成功、失败回收、响应丢失、公开访问、非站主界面拒绝、退出、非法文件和云端不可用时的静态收藏回退；不验证真实 Supabase 的数据库 RLS。实际项目配置完后，必须补做第 5 节的真实服务验收。当前实现尚未接入真实项目，也未部署本次上传功能。

如果 main 上还没有这些文件，请切换到 `feat/owner-gallery-upload` 分支查阅。本分支通过 Pull Request 提供审阅；PR 只运行测试和构建，不部署。合并 main 会触发现有自动部署，因此请在准备好上线时再合并。
