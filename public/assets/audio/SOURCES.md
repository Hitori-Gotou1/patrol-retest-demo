# 演示音频来源

本目录三段音频均由本站的 [生成脚本](../../../scripts/generate-demo-audio.py) 使用 Python 标准库合成。波形、包络、和弦音型和节拍均在脚本中定义，没有下载音源、引用现有录音、采样或转录动画歌曲。

它们是用于验证播放器功能的原创练习 Demo，**不是结束乐队原曲、官方音源或动画配乐**。播放器应保留曲名中的 Demo 标记和数据中的来源说明；不要将其呈现为结束乐队歌曲。

| 文件 | 内容 | 时长 | 格式 |
| --- | --- | --- | --- |
| `demo-pink-room.wav` | 粉色练习室 · Demo | 12 秒 | 22050 Hz / 单声道 / 16-bit PCM WAV |
| `demo-blue-hour.wav` | 蓝调休息时刻 · Demo | 12 秒 | 22050 Hz / 单声道 / 16-bit PCM WAV |
| `demo-soundcheck.wav` | 开场前的试音 · Demo | 12 秒 | 22050 Hz / 单声道 / 16-bit PCM WAV |

每个文件约 517 KiB，三段合计约 1.52 MiB。使用 WAV 是为了不引入编码器依赖，并兼容现代浏览器。文件包含首尾淡入淡出，峰值约 -8.87 dBFS。脚本使用固定随机种子，便于复现。页面不应自动播放有声内容。

在仓库根目录重新生成并校验：

```sh
python3 scripts/generate-demo-audio.py
```

脚本会检查声道、采样率对应的帧数、首尾静音和削波情况，并输出时长、文件大小、峰值及 RMS。

曲目资料位于 [src/data/music.json](../../../src/data/music.json)。封面复用本站原创 SVG 排版海报。以后获得合适授权的音乐后，可在该文件替换 `src`、`title`、`subtitle`、`duration`、`credit` 和 `cover`，并在此记录音频来源及具体许可条件。普通视频网站观看页不是可直接赋给 `audio.src` 的文件地址。
