# 从本地文件夹添加 GitHub 图库图片

这个工具用于将图片加入仓库内的收藏图库。它只追加新记录与新文件；现有图片、标题、收藏 ID 和顺序保持不变。网页中的 Supabase 上传流程独立运行，不受影响。

需要 Python 3.10 或更新版本。先在仓库根目录安装图片处理依赖，再导入一个文件夹：

```sh
python -m pip install -r tests/requirements-gallery.txt
python scripts/import-gallery.py /path/to/new-images
python scripts/import-gallery.py --check
```

工具递归查找 `.jpg`、`.jpeg`、`.png`、`.webp`，扩展名不区分大小写，其他文件会忽略。文件夹不要放入仓库的 `public/assets/gallery` 中，以免将生成的预览再次当作新图片导入。输入文件保留在原位置。没有可导入图片、图片损坏、内容与扩展名不符、动画图片、单文件超过 50 MiB 或超过 4000 万像素时，导入会报错，不追加任何图库记录或图片。

每张新图片生成以下内容，`<sha256>` 是原文件完整内容的 SHA-256：

| 内容 | 路径 / 字段 |
| --- | --- |
| 原图的逐字节副本 | `public/assets/gallery/imported/originals/<sha256>.<ext>` → `originalSrc` |
| 最长边不超过 1600 px 的 WebP，质量 86 | `public/assets/gallery/imported/previews/<sha256>.webp` → `src` |
| 最长边不超过 640 px 的 WebP，质量 82 | `public/assets/gallery/imported/thumbs/<sha256>.webp` → `thumbnail` |
| 新收藏记录 | 追加到 `src/data/gallery-upload.json`，ID 为 `collection-<sha256>` |

预览和缩略图保持比例，不放大小图，保留透明通道，并应用 EXIF 方向。记录中的 `width` / `height` 是旋转后的原图尺寸。生成图片不附带 EXIF；原文件内容（包括原有元数据）完整保留。JPEG 的输出扩展名统一为 `.jpg`。

## 标题、描述与来源

默认标题来自文件名（去掉扩展名，将连字符和下划线换为空格，最多 120 字符），默认描述与标题相同。可以在导入时提供一个 JSON 文件，键名是相对于输入文件夹的路径，使用 `/`：

```json
{
  "summer-night.jpg": {
    "title": "夏日夜晚",
    "alt": "四位成员在舞台灯光下演奏",
    "credit": "作者姓名 · 来源链接"
  },
  "posters/live.png": {
    "title": "下一场演出"
  }
}
```

```sh
python scripts/import-gallery.py /path/to/new-images --metadata /path/to/metadata.json
```

三个字段都可省略。`title` 非空且最多 120 字符，`alt` 最多 300 字符，`credit` 最多 200 字符；前后空格会移除。文件名拼写错误、未知字段和非法值会阻止整批导入。未提供来源时使用“站主提供 · 原作者信息待补充”，可在提交前编辑新记录补充。

## 重复图片与检查

相同原文件的字节内容只导入一次，包括已存在的图库原图和本次文件夹内的副本。改名后再次运行也会跳过，不修改已有标题或 ID。输入按相对路径排序；同一批中内容相同的多个文件使用第一个文件的标题和元数据。重新编码、编辑或删除 EXIF 会改变内容哈希，因而被视作新图片。

所有候选图片都要通过完整解码和元数据验证后，才会发布新文件并原子替换 JSON 清单。目标路径已存在时不会覆盖。常规写入失败会清理本次新增文件；如果进程被强制终止，应先检查工作区中的暂存目录 `.gallery-import-*` 和未追踪图片，再重新运行。一次只运行一个导入进程。

`--check` 只读取清单和文件路径，不生成图片，也不需要 Pillow。它验证 JSON 结构、唯一 ID（包括三个内置作品的保留 ID）、文字与尺寸字段、以及 `src` / `thumbnail` / `originalSrc` 是否是 `public/` 内存在的文件。绝对路径、外部 URL、路径跳转和指向 `public/` 外的符号链接会被拒绝。它不会重新解码现有图片，也不会要求旧记录采用新图片的输出路径或尺寸。

```sh
python scripts/import-gallery.py --check
git diff -- src/data/gallery-upload.json
git status --short
```

检查新记录的标题、描述、来源和图片后，将新增资产与清单一起提交。工具本身不会提交、推送或部署。

## 测试与其他工作区

```sh
python -m unittest discover -s tests -p 'test_gallery_import.py' -v
python scripts/import-gallery.py --root /path/to/another-checkout --check
```

默认根目录由脚本所在位置确定，不依赖当前 shell 目录。`--root` 可以指定另一个仓库根目录；其中必须已有 `src/data/gallery-upload.json`（空图库可用 `[]`）和对应的 `public/` 资产。测试使用临时目录与合成图片，不会修改真实图库。
