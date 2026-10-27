# 角色素材

## 已接入的用户提供立绘

2026-10-27，站主在对话中提供以下两张透明 PNG，用于替换对应角色占位。仓库文件与上传文件逐字节一致，没有重绘、去背景、裁切或放大处理；保留原图已有的边缘与细节。

| 文件 | 上传文件名 | 尺寸 | SHA-256 |
| --- | --- | --- | --- |
| `hitori.png` | `full_body_anime_illustration_on_a_transparent_back.png` | 977 × 1610，RGBA | `0cdd655e2e9d8263561373b3671326ed115b9838bffe6d5d672b4c3982030142` |
| `nijika.png` | `ijichi_nijika_3000px.png` | 1038 × 3000，RGBA | `92de033dddd59cf5a6af4b70951b4e44e404627617d3a7197dd66a6afc7093f5` |

来源记录为站主上传，不将图片标为本站原创或声称官方授权。一里原图有少量半透明边缘残留；虹夏原图左侧裙摆已接触画布边界，线条带有放大痕迹。网站通过 `object-fit: contain` 保留整个原始画布，不额外截断人物，也不声称恢复原图未包含的细节。

## 现有占位

`hitori.svg`、`nijika.svg`、`ryo.svg` 和 `kita.svg` 是本项目之前绘制的原创几何人物印象图，没有使用、描摹或嵌入官网立绘。一里和虹夏的 SVG 留作历史备用，页面已切换为 PNG。山田凉与喜多郁代仍使用原有 SVG，尚未收到 `ryo.png` 和 `kita.png`。

## 资料与展示配置

在 `src/data/characters.json` 中设置：

- `portrait`：项目相对素材路径，例如 `assets/characters/hitori.png`。
- `portraitAlt`、`portraitSize`：真实图片描述与宽高。
- `placeholder`：已接入用户立绘的成员为 `false`，原有 SVG 占位成员为 `true`。
- `portraitLayout.scale/x/y/objectPosition`：全身展示的统一缩放与百分比偏移，按可见人物区域校准；不拉伸图片。
- `portraitLayout.thumbnailPosition/thumbnailScale/thumbnailOrigin`：头像按钮的独立取景，不影响完整立绘。

后续收到凉和喜多的 PNG 后，放到当前目录、更新对应成员资料，并在此记录来源。每位角色的 `theme`、`motion`、`decoration`、`reactions` 继续集中管理主题色、动画和原创互动文案。
