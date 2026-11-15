# 声音、段落编曲与真实导出（13、21、22、23）

## 用户操作与行为

- 导航音效旁的设置可统一调整音乐、乐器与玩法、雨夜环境声，并可总静音。三个音量与总静音保存在本机且响应跨标签页变化。互动音效偏好也保留；重开页面不会自动发声，由下一次主动乐器操作或播放激活。
- 音乐、编曲、完整演出、混音修复和雨夜环境声互斥；短乐器音效保留独立互动。环境声与互动开关分离。切后台、离页或音频设备变化会暂停长音频，需主动播放恢复。设备恢复或初始化失败有说明，关闭的 Web Audio context 可重新创建。
- 编曲保持单小节起步，可复制为最多 16 小节，逐小节命名、前移、后移、删除，选择循环起止。播放位置和编辑位置分别显示。手机一次编辑一轨八步，切轨与步骤分段不缩小目标；沿用全屏编辑、模板与作品架。
- WAV 导出包含所选循环范围、BPM、循环次数和吉他音色，保留 2.4 秒尾音；立体声 PCM16 / 44.1 kHz。试听与导出共用确定性的合成与音色图，按峰值统一约束到 0.94，避免削波。导出有实际音频进度、取消及三分钟上限。
- 完整演出可导出横版 16:9 或竖版舞台票根 9:16，长边 960 / 1280、10 / 20 / 30 / 60 秒上限。舞台背景、角色、海报、灯光和完整段落声音均进入真实 canvas + MediaRecorder 文件，声音与画面共享 AudioContext 时间。浏览器支持什么编码就输出相应的真实扩展名；Chromium 实测 VP9 + Opus 的 WebM。没有编码支持时说明 PNG、WAV、项目 JSON 替代方式。
- 视频导出不将声音送入扬声器、不需要麦克风、保持页面可见；后台会停止并说明，取消或完成后释放 stream tracks、context 与 canvas。WebM 补入实际 Duration 元数据，能正确显示长度和定位。

## 数据与兼容

`pattern.js` 保留原有 v1 `{ version:1,name,bpm,masks:[4个16bit] }` 的原样返回；新多小节使用 v2 `{version:2,name,bpm,bars:[{id,name,masks}],loop:{start,end}}`，end 为包含的末小节。编号唯一、最多16小节、每节名24字、总名60字，BPM60–180，JSON仍限制16KiB，链接为有界base64url。旧作品、旧项目、JSON和分享链接仍通过原验证器；作品架数量、3MiB总空间及单份大小完全不变。灯光继续16步循环，声音按多小节推进，项目clock同样适配。

无新增后端、凭据、账号或统一备份。导出监听音量与作品音量分开：总静音不删除导出文件中的作品声音，界面明确说明。

## 验证与可复核证据

- `node --test tests/arrangement.test.js tests/room-core.test.js tests/guitar-effects.test.js tests/interaction-audio.test.js tests/ambient-audio.test.js tests/expansion.test.js` 通过。新逻辑覆盖v1/v2往返、无效字段、独立复制、排序/删除/16小节上限、循环事件时间、项目统一clock、WAV头/PCM、取消/过长渲染、三类音量和WebM Duration封装。
- `npm run build` 通过；构建与其他模块同时集成后由主代理再跑一次。
- `python tests/browser-audio-exports.py` 使用真实 Chromium 从UI创建两小节、修改节拍、导出 WAV，然后装入完整演出、开启项目吉他音色，实际生成横版与竖版视频。浏览器重新打开生成文件并 `play()`，currentTime 正常前进，零 pageerror。没有使用模拟音频或模拟后端。
- `python tests/browser-audio-controls.py` 通过：手机8格×单轨、44px高触控、全屏编辑/保存/退出/焦点恢复、音量跨刷新、总静音阻止播放、真实视频取消、设备变化事件停止。设备物理拔插未做；测试用事件覆盖处理逻辑。
- 真实样本见 `evidence/audio/`。`arrangement.wav`：7.400秒，音乐5.000秒+2.400秒尾音；44100Hz双声道，peak0.9400006（PCM量化），RMS0.092545，非空声音。浏览器音频实际播放currentTime0.603秒且未暂停。
- `concert.webm`：VP9+Opus，960×540，7.450秒；`concert-portrait.webm`：540×960，7.450秒。浏览器实际解码视频960×540、currentTime0.580秒。`video-probe.json` / `portrait-probe.json` 是 ffprobe 原始输出。
- 横版视频声画stream起始时间差为0.019秒；视频0.25秒与2.8秒画面均值差2.5410，实际灯光在变。此项验证共用clock、编码时间戳及画面变化，不声称人工感知级延迟测量。`analysis.json` 与 `playback.json` 保留测量。
- Chromium与本地真实导出已验；Safari、Firefox的不同MediaRecorder格式须在目标设备继续实测，未声称已验证。视频原生实时录制，导出耗时约为视频长度；性能数值不作虚构提升。

追加兼容与同步检查：

- 生产隔离构建 `/tmp/hitori-audio-final` 后，`tests/browser-room.py --case studio` 旧流程通过，包含老单小节、播放/停止、旧分享、确认保存、坏链接、坏JSON及原记录保护；零 pageerror / missingAssets / externalRequests。离线渲染是异步过程，旧测试仅补等待播放就绪后再推进测试时钟，保留所有断言。
- `PatternStudio` 与其他编辑器使用统一 `createDraftPersistence`，写入前检查原始数据及账号绑定；接收跨标签 / 同步新稿时停止旧播放，拒绝迟到的旧写。真的同时修改进入全站草稿冲突提示，两稿保留，分享试听不参与自动flush。真实浏览器双标签写入B后，打开的编曲A采用B，离页不覆盖B；`controls.json` 的 `externalDraftAdopted:true`。
- 视频长度上限也限制内部音频渲染，因此长项目可导出所选10–60秒片段，不必先渲染整段超长项目；独立WAV仍遵守三分钟上限。
