// 合成音色和音高集中管理，可在这里调整调弦；将来可把引擎的 bufferFor 替换为授权采样。
export const instrumentProfiles = {
  hitori: { type: 'guitar', label: '电吉他', caption: '六根弦，一点点勇气。', notes: [82.41, 110, 146.83, 196, 246.94, 329.63], names: ['E₂', 'A₂', 'D₃', 'G₃', 'B₃', 'E₄'] },
  nijika: { type: 'drums', label: '架子鼓', caption: '从第一个鼓点开始合奏。', pads: [{ id: 'kick', name: '底鼓', key: 'A' }, { id: 'snare', name: '军鼓', key: 'S' }, { id: 'hat', name: '镲片', key: 'D' }] },
  ryo: { type: 'bass', label: '电贝斯', caption: '低一点，也很有存在感。', notes: [41.2, 55, 73.42, 98], names: ['E₁', 'A₁', 'D₂', 'G₂'] },
  kita: { type: 'guitar', label: '吉他与主唱', caption: '今天也要闪闪发光地练习。', microphone: true, notes: [82.41, 110, 146.83, 196, 246.94, 329.63], names: ['E₂', 'A₂', 'D₃', 'G₃', 'B₃', 'E₄'] }
};
