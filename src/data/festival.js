export const festivalPath = '/room/festival';
export const festivalTitle = 'STARRY 地下文化祭';

export const festivalStations = [
  { id: 'patch', title: '琴盒布章社', short: '布章社', english: 'PATCH CLUB', icon: '◉', color: '#e5ae58', description: '在绣绷上走针，给琴盒缝一枚自己的布章。' },
  { id: 'animation', title: '阁楼手摇动画柜', short: '动画柜', english: 'FLIPBOOK BOOTH', icon: '▤', color: '#9aabc8', description: '给纸偶摆姿，逐格制作动画，手摇放映。' },
  { id: 'soundcheck', title: 'Live House 空场试声日', short: '空场试声', english: 'SOUNDCHECK', icon: '◈', color: '#87a992', description: '挪动座位、挂上吸声帘，听鼓声怎样穿过空场。' },
  { id: 'zine', title: '一张纸同人志编辑部', short: '同人志编辑部', english: 'ONE-SHEET PRESS', icon: '◩', color: '#de9c97', description: '收进自己的作品，用一张 A4 纸折出八页同人志。' }
].map(station => ({ ...station, path: `${festivalPath}/${station.id}` }));
