# 一里小屋 · HITORI ROOM

以《孤独摇滚！》后藤一里为主题的个人同人网站，适配手机和电脑。使用原生 HTML、CSS、JavaScript，无构建步骤或第三方运行依赖。

## 已实现

- 角色介绍与粉色舞台风格首页。
- AI 生成的同人封面插画、两张原创图形海报。
- 相册分类筛选、图片放大、方向键切换、Esc 关闭。
- 使用浏览器 localStorage 保存收藏；只保存在当前设备。
- 视频播放区及本地视频预览。本地选择的文件不会上传，刷新后需要重新选择。
- 键盘导航、减少动态效果偏好、手机端布局。

## 本地运行

在仓库目录执行：

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

在本机浏览器中访问端口 8000。Codex 云环境中的此地址仅供内部验证，并不是公开网站地址。

## 修改内容

- `index.html`：文字、角色资料、页面结构。
- `styles.css`：颜色、排版、响应式布局。
- `site-data.js`：首页封面、相册素材和公开视频配置。
- `assets/`：本网站实际使用的图片、视频和图标。

添加图片时，把文件放入 `assets/`，在 `site-data.js` 的 `gallery` 数组中加入条目。路径使用 `assets/example.jpg` 这样的相对路径，不要以 `/` 开头，否则 GitHub Pages 的项目子路径会失效。分类可用 `illustration` 或 `poster`。导航筛选器中的总数目前为 03；增减素材时也应相应修改。

公开视频目前尚未配置。选好有使用权限的 MP4 或 WebM 文件后放进 `assets/`，修改 `site-data.js`：

```js
video: {
  src: 'assets/my-video.mp4',
  title: '我的珍藏片段',
  description: '想再看一遍的瞬间。',
  poster: 'assets/bocchi-cover.png'
}
```

`src` 也可以是允许外站播放的 HTTPS 视频文件地址，不能直接使用普通视频网站的观看页网址。大视频建议使用专门的视频托管服务。浏览器支持的编码有所不同，通常可选择 MP4（H.264/AAC）或 WebM。网页上的“选择本地视频”只用于当前浏览器预览，无法让其他访客看到该文件。

## 发布到 GitHub Pages

1. 将本网站文件提交、推送到 `Hitori-Gotou1/patrol-retest-demo` 仓库的 `main` 分支。
2. 在 GitHub 仓库中打开 **Settings → Pages**。
3. 在 **Build and deployment** 中选择 **Deploy from a branch**。
4. 选择 **main** 分支及 **/ (root)**，保存。
5. 等待 Pages 部署成功，访问 GitHub 提供的网站地址。此仓库的默认地址通常为 `https://hitori-gotou1.github.io/patrol-retest-demo/`。

`.nojekyll` 用于直接发布静态文件。发布前确认仓库可使用 Pages，素材可公开展示，文件中没有私密信息或密钥。Codex 环境的发布与 GitHub Pages 网站的发布是两个独立步骤。

## 素材说明

本站为非官方同人空间，角色及原作品权利归原权利人所有。`assets/bocchi-cover.png` 为 AI 生成的同人插画，不是动画截图；其余两张海报为原创 SVG 图形排版。没有使用未经确认的演出视频，也没有伪造官方授权。后续替换素材时请保留准确的来源说明。
