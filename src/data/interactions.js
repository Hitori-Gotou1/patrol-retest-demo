// 三套互动可独立关闭；素材、连击阈值和台词集中在这里修改。
export const interactionFeatures = { easterEggs: true, instruments: true, liveMode: true };
export const easterEggSettings = {
  windowMs: 4000, cooldownMs: 180, panicAt: 3, boxAt: 5,
  durationMs: 2300, boxAsset: 'assets/interactions/bocchi-box.svg'
};
export const characterReactions = {
  hitori: ['诶……是在叫我吗？', '社交电量，还剩一点点。', '别、别连着看我啦！'],
  nijika: ['一、二、三、四！跟上这个节拍。', '下一次练习，也要四个人一起！', '今天的节拍，交给我吧。'],
  ryo: ['低音已经够了。零用钱还不够。', '买完这把贝斯，再考虑晚饭。', '草？只是正在研究菜单。'],
  kita: ['今天也要练到比昨天更好！', '一起站到灯光下吧！', '这个和弦，我又学会啦。']
};
