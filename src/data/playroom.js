import characters from './characters.json' with { type: 'json' };

export const playroomCards = [
  { id: 'photobooth', number: '01', title: '结束乐队拍贴机', en: 'PHOTO BOOTH', icon: '▣', color: '#f2b5cc', description: '四个人、几张贴纸，留下一张属于你的合影。', action: '拍一张合影' },
  { id: 'decorate', number: '02', title: '布置一里的房间', en: 'MY LITTLE ROOM', icon: '⌂', color: '#edcf85', description: '摆好吉他和纸箱，把房间点亮成喜欢的样子。', action: '推开房间的门' },
  { id: 'walk', number: '03', title: '下北泽散步地图', en: 'A SMALL WALK', icon: '↗', color: '#9ec9c1', description: '从车站走到舞台，收集六枚街角的印章。', action: '出去走一小段' },
  { id: 'search', number: '04', title: '排练室寻物', en: 'LOST & FOUND', icon: '⌕', color: '#adc8e4', description: '拨片又跑到哪里去了？帮大家找齐开演的小物。', action: '帮忙找一找' },
  { id: 'concert', number: '05', title: '今晚的演出由你筹备', en: 'ONE NIGHT LIVE', icon: '★', color: '#d9b3ca', description: '分配预算、应对意外，办一场自己的小小演出。', action: '接过筹备清单' },
  { id: 'ambient', number: '06', title: '雨夜 STARRY', en: 'SOUNDS OF THE NIGHT', icon: '☂', color: '#b2bfdc', description: '把雨声、街道和试音，混成今晚的背景。', action: '听一听这座城市' }
];
export const cast = characters.map(c => ({ id: c.id, name: c.name, image: c.thumbnail, width: c.thumbnailSize.width, height: c.thumbnailSize.height, color: c.theme.primary }));
export const stickers = [
  { id: 'star', text: '✦', name: '小星星', color: '#b08521' }, { id: 'heart', text: '♥', name: '心动', color: '#bd547e' },
  { id: 'note', text: '♪', name: '音符', color: '#5c709f' }, { id: 'bocchi', text: 'ぼっち！', name: '波奇签名', color: '#8e5b81' },
  { id: 'together', text: 'ひとりじゃない。', name: '并不孤单', color: '#537d72' }, { id: 'live', text: 'LIVE!', name: '开演', color: '#b65347' }
];
export const photoThemes = [
  { id: 'pink', label: '粉色放学后', paper: '#fff6eb', background: '#efd0dc', ink: '#664658', accent: '#ba647e' },
  { id: 'night', label: '今晚的舞台', paper: '#e9dfcb', background: '#302b43', ink: '#4e3e56', accent: '#bb8aa4' },
  { id: 'mint', label: '街角晴天', paper: '#fff8e8', background: '#c8d9cb', ink: '#405d55', accent: '#71866c' }
];
export const roomProps = [
  { id: 'guitar', name: '电吉他', w: 65, h: 135 }, { id: 'amp', name: '音箱', w: 115, h: 95 },
  { id: 'box', name: '纸箱', w: 120, h: 95 }, { id: 'poster', name: '演出海报', w: 85, h: 120 },
  { id: 'plant', name: '小盆栽', w: 70, h: 100 }, { id: 'lamp', name: '落地灯', w: 85, h: 150 },
  { id: 'photo', name: '四人合照', w: 120, h: 90 }, { id: 'chair', name: '小椅子', w: 80, h: 100 }
];
export const walkPlaces = [
  { id: 'station', name: '放学后的车站', stamp: '出发', x: 128, y: 346, member: 'kita', title: '先从这一步开始。', text: '喜多把地图摊开，又认真折回能放进口袋的大小。「不用一下子走很远，今天先到下一个路口吧。」', detail: '盖下一枚车票形状的章。今天的散步开始了。' },
  { id: 'shop', name: '街角乐器店', stamp: '试音', x: 330, y: 140, member: 'ryo', title: '橱窗里的低音。', text: '凉停在橱窗前很久。标价牌、贝斯、空空的钱包，构成了一段短暂而安静的对话。你们最后决定：先把想买的东西写进愿望清单。', detail: '一枚拨片印章，留给还没买下的梦想。' },
  { id: 'vending', name: '自动贩卖机', stamp: '休息', x: 532, y: 310, member: 'hitori', title: '给自己一点停顿。', text: '一里握着刚买的饮料，罐子还带着凉意。她小声说，和人一起坐在路边喝点什么，好像也可以算今天很努力的一件事。', detail: '饮料罐轻轻碰了一下。休息也属于旅途。' },
  { id: 'park', name: '口袋小公园', stamp: '晴天', x: 724, y: 135, member: 'nijika', title: '树影里的四拍。', text: '虹夏用鞋尖数着地砖上的光斑。一、二、三、四。大家试着按同一个节拍往前走，结果笑声比脚步先乱了。', detail: '收下一枚叶子章，把这阵风也夹进手帐。' },
  { id: 'bridge', name: '晚风小路', stamp: '晚风', x: 774, y: 400, member: 'ryo', title: '安静也很好。', text: '走到这里时，街道的声音慢慢远了。凉说，不必每一段沉默都填上话。有时候，只要知道旁边的人还在走就够了。', detail: '这一枚印章没有很响，只留下细细的风。' },
  { id: 'starry', name: 'STARRY 门口', stamp: '开演', x: 348, y: 450, member: 'hitori', title: '灯亮着，就进去吧。', text: '门后传来还没调好的吉他声。一里把手伸向门把，又回头看了看大家。她这次没有把准备好的话忘掉：「我、我们回来了。」', detail: '最后一枚星星章。路的尽头，是四个人的舞台。' }
];
export const searchObjects = [
  { id: 'pick', label: '粉色拨片', icon: 'pick', zone: '吉他旁', reply: '一里：找、找到了！这回不用拿硬币代替拨片了。' },
  { id: 'tuner', label: '调音器', icon: 'tuner', zone: '小桌附近', reply: '虹夏：先把音调好，再一起数四拍吧。' },
  { id: 'coin', label: '凉的零钱', icon: 'coin', zone: '地板角落', reply: '凉：今天的饮料预算，有着落了。' },
  { id: 'drink', label: '汽水', icon: 'drink', zone: '音箱附近', reply: '喜多：先喝一口，待会儿再继续练习！' },
  { id: 'sticks', label: '鼓棒', icon: 'sticks', zone: '凳子附近', reply: '虹夏：我的另一双手原来在这里。' },
  { id: 'cable', label: '连接线', icon: 'cable', zone: '地毯附近', reply: '一里：原来刚才没有声音，是因为还没插线……' },
  { id: 'ticket', label: '演出票根', icon: 'ticket', zone: '海报附近', reply: '喜多：这张要认真夹进手帐里。' },
  { id: 'headphones', label: '耳机', icon: 'headphones', zone: '窗边', reply: '凉：听一听这条贝斯线。' },
  { id: 'notebook', label: '歌词本', icon: 'notebook', zone: '书堆旁', reply: '一里：最、最后一页还没写完，先不要看！' },
  { id: 'key', label: '排练室钥匙', icon: 'key', zone: '纸箱附近', reply: '虹夏：有了它，明天也能一起练习。' },
  { id: 'clip', label: '蓝黄发饰', icon: 'clip', zone: '椅背附近', reply: '一里：是我的！难怪今天总觉得少了点什么。' },
  { id: 'pen', label: '签字笔', icon: 'pen', zone: '架子附近', reply: '喜多：下次的演出海报，就用它写吧。' }
];
export const concertOptions = {
  sound: { label: '设备与试音', choices: [{ id: 'basic', label: '熟悉的小音箱', cost: 300, reach: 0, quality: 12 }, { id: 'balanced', label: '完整试音与监听', cost: 600, reach: 4, quality: 27 }, { id: 'pro', label: '借来一套好设备', cost: 900, reach: 7, quality: 35 }] },
  promo: { label: '宣传方式', choices: [{ id: 'friends', label: '邀请朋友来听', cost: 100, reach: 10, quality: 6 }, { id: 'posters', label: '手写海报和传单', cost: 300, reach: 24, quality: 4 }, { id: 'online', label: '海报加线上预告', cost: 500, reach: 34, quality: 3 }] },
  lights: { label: '舞台灯光', choices: [{ id: 'warm', label: '一盏温暖的聚光', cost: 100, reach: 2, quality: 10 }, { id: 'colors', label: '四种颜色的灯光', cost: 250, reach: 5, quality: 18 }, { id: 'night', label: '整场灯光编排', cost: 400, reach: 8, quality: 23 }] }
};
export const concertEvents = [
  { id: 'rain', title: '开演前，忽然下起雨。', text: '门口的观众躲在屋檐下。距离开门，还有十分钟。', choices: [{ id: 'shelter', label: '花 100 元准备雨具与热饮', cost: 100, reach: 10, quality: 8, ending: '门口多了一小排雨伞，观众带着暖意走进来。' }, { id: 'acoustic', label: '在门口弹一段暖场', cost: 0, reach: 4, quality: 5, ending: '雨声替那段短短的吉他，加上了温柔的底鼓。' }] },
  { id: 'cable', title: '试音时，连接线突然失灵。', text: '音箱沉默了一下，大家一起看向了地上的线。', choices: [{ id: 'replace', label: '花 150 元换一条备用线', cost: 150, reach: 4, quality: 12, ending: '新的连接线接上了。熟悉的声音终于重新响起。' }, { id: 'borrow', label: '向隔壁乐队借线并致谢', cost: 0, reach: 2, quality: 5, ending: '隔壁乐队递来了连接线，也留下了一句「加油」。' }] },
  { id: 'nerves', title: '幕布后，一里有点紧张。', text: '她握着拨片，脑内已经把所有可能出错的地方排练了一遍。', choices: [{ id: 'together', label: '四个人再数一次开场的拍子', cost: 0, reach: 3, quality: 12, ending: '一、二、三、四。她抬起头，看见三个人都在等她。' }, { id: 'quiet', label: '留出安静的一分钟', cost: 0, reach: 2, quality: 9, ending: '没人催她。安静的一分钟过去，第一步由她自己迈出。' }] }
];
export const ambientLayers = [{ id: 'rain', label: '屋檐雨声', hint: '细密的雨，落在门外' }, { id: 'street', label: '远处街道', hint: '晚风和城市的低鸣' }, { id: 'tuning', label: '台上的试音', hint: '隔一会儿，轻轻拨一根弦' }, { id: 'crowd', label: '散场的人群', hint: '像隔着一扇门的模糊声响' }];
export const ambientPresets = [
  { id: 'rainy', name: '雨夜的 STARRY', light: 'violet', levels: { rain: .65, street: .18, tuning: .3, crowd: .1 } },
  { id: 'before', name: '开场之前', light: 'amber', levels: { rain: 0, street: .12, tuning: .65, crowd: .35 } },
  { id: 'walk', name: '散步回家的路', light: 'blue', levels: { rain: .2, street: .55, tuning: 0, crowd: .18 } }
];
