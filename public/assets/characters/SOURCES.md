# 角色图形占位

`hitori.svg`、`nijika.svg`、`ryo.svg` 和 `kita.svg` 为本项目绘制的原创几何人物印象图，以角色配色和乐器为主题，没有使用、描摹或嵌入官网立绘。它们用于开发阶段的立绘占位，不是动画官方素材。

替换为已取得适当使用许可的立绘时，将新资源放在此目录，并修改 `src/data/characters.json` 中的 `portrait` 与 `portraitAlt`，同时记录作者、来源和许可条件。页面图形占位标签也应随实际素材更新。

## 本次角色转场升级的素材状态

2026-10-27 检查本地文件与当时 GitHub `main` 分支时，下列透明 PNG 尚未存在：

- `public/assets/characters/hitori.png`
- `public/assets/characters/nijika.png`
- `public/assets/characters/ryo.png`
- `public/assets/characters/kita.png`

因此本次转场开发继续使用已有 SVG 占位，没有另外生成、下载或替换人物图。当前 `src/data/characters.json` 中的 `placeholder` 为 `true`；不能将这次 SVG 验证视为对高清 PNG、透明留白或图像清晰度的验收。

收到四张 PNG 后，将文件放到上述位置，并分别把角色数据中的 `portrait` 改为 `assets/characters/角色ID.png`、更新 `portraitAlt`、将 `placeholder` 改为 `false`。人物展示使用等比完整容纳；通过同一条数据中的 `portraitLayout` 调整透明留白带来的视觉差异：

```json
"portraitLayout": {
  "scale": 1,
  "x": 0,
  "y": 0,
  "objectPosition": "50% 50%"
}
```

`scale` 是统一缩放系数，`x`、`y` 为百分比偏移。现有占位统一使用 1 倍、零偏移；真实 PNG 接入后再按可见人物区域调节，避免拉伸、裁切或遮挡文字。每位角色的 `theme`、`motion`、`decoration`、`reactions` 也集中在同一数据文件中，分别管理主题颜色、入退场与漂浮参数、背景装饰和原创互动文案。
