# 角色素材

## Q 版头像与立绘旁的小伙伴

2026-10-28，下方角色选择按钮的小图标与大立绘右下方的小伙伴共用站主最后提供的四张 Q 版 PNG。小伙伴等比完整展示，复用大立绘的转场、漂浮和彩蛋容器；触发纸箱彩蛋时一起隐藏和恢复。上方大立绘和 STARRY 舞台继续使用原有全身 PNG。最初提供的白底 `1000017673.png` 未采用。以下文件与上传文件逐字节一致，没有重绘、去背景、裁切、放大或重新压缩。

| 角色 | 文件 | 上传文件名 | 尺寸 | SHA-256 |
| --- | --- | --- | --- | --- |
| 后藤一里 | `hitori-chibi.png` | `1000017680.png` | 659 × 715，RGBA | `5761cffc8e1eacc362210e816db4bf1faa84193a5bf6750e0b13d13ce66d132a` |
| 伊地知虹夏 | `nijika-chibi.png` | `1000017679.png` | 1284 × 1225，RGBA | `9fe8ac978c4312ce480b0af2b2dacd6256b430b7890b085bc58b570d8059fd2a` |
| 山田凉 | `ryo-chibi.png` | `1000017681.png` | 594 × 724，RGBA | `dc359259acf7d4b90aca139adc08ed91182a0390a28e764a8e9f5910ae1b322d` |
| 喜多郁代 | `kita-chibi.png` | `1000017682.png` | 627 × 724，RGBA | `490140969163e586fdbeb386f6d739b1476da96d3a041837dd46afe0033fd796` |

四张图片具有真实 Alpha 透明通道，四个角均完全透明。经浏览器在浅色、深色和角色主题背景上的正常展示尺寸检查，未见明显矩形底色或白边。保留原始边缘像素，不使用 CSS 混合模式或滤镜掩盖背景，也不声称重建了原图没有的细节。虹夏画布两侧透明留白较多，通过头像取景参数与独立的小伙伴展示参数校准视觉尺寸。

来源记录为站主上传，不将图片标为本站原创或声称官方授权。

## 当前大立绘与舞台素材

2026-10-27，站主在对话中提供以下四张透明 PNG，用于替换对应角色占位。目前上方大立绘与 STARRY 舞台继续使用这些文件，原有尺寸、位置和动画参数保持不变。仓库文件与上传文件逐字节一致，没有重绘、去背景、裁切或放大处理；保留原图已有的边缘与细节。

| 文件 | 上传文件名 | 尺寸 | SHA-256 |
| --- | --- | --- | --- |
| `hitori.png` | `full_body_anime_illustration_on_a_transparent_back.png` | 977 × 1610，RGBA | `0cdd655e2e9d8263561373b3671326ed115b9838bffe6d5d672b4c3982030142` |
| `nijika.png` | `ijichi_nijika_3000px.png` | 1038 × 3000，RGBA | `92de033dddd59cf5a6af4b70951b4e44e404627617d3a7197dd66a6afc7093f5` |
| `ryo.png` | `yamada_ryo_3000px.png` | 1040 × 3000，RGBA | `555977e788481e60818280dbfe88d9691812034672df33000754cdf41654b42a` |
| `kita.png` | `kita_ikuyo_3000px.png` | 1130 × 3000，RGBA | `6f78ba5a807e1794ad78ee7d3866f8cd97fb2dc948acb2339b50d9061a7fb368` |

来源记录为站主上传，不将图片标为本站原创或声称官方授权。一里原图有少量半透明边缘残留；虹夏原图左侧裙摆已接触画布边界，线条带有放大痕迹。网站通过 `object-fit: contain` 保留整个原始画布，不额外截断人物，也不声称恢复原图未包含的细节。

## 历史占位备份

`hitori.svg`、`nijika.svg`、`ryo.svg` 和 `kita.svg` 是本项目之前绘制的原创几何人物印象图，没有使用、描摹或嵌入官网立绘。四张 SVG 仅留作历史备用。

## 资料与展示配置

在 `src/data/characters.json` 中设置：

- `portrait`：大立绘与舞台的项目相对素材路径，例如 `assets/characters/hitori.png`。
- `portraitAlt`、`portraitSize`：真实图片描述与宽高。
- `thumbnail`、`thumbnailSize`：角色选择按钮与立绘旁小伙伴共用的独立图片路径与真实宽高，例如 `assets/characters/hitori-chibi.png`；与大立绘素材分开管理。
- `placeholder`：已接入用户立绘的成员为 `false`，原有 SVG 占位成员为 `true`。
- `portraitLayout.scale/x/y/objectPosition`：角色区完整展示的缩放与百分比偏移，按可见人物区域校准；不拉伸图片。
- `portraitLayout.thumbnailPosition/thumbnailScale/thumbnailOrigin`：头像按钮的独立取景，不影响完整立绘。
- `companionLayout.scale/x`：完整 Q 版小伙伴的留白补偿缩放与横向偏移，不改变大立绘或头像按钮。

今后更换立绘时，放到当前目录、更新对应成员资料，并在此记录来源。每位角色的 `theme`、`motion`、`decoration`、`reactions` 继续集中管理主题色、动画和原创互动文案。
