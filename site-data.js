// Use repository-relative paths so the site works under a GitHub Pages project URL.
// To publish a video, add a file to assets/ and set video.src, for example assets/live.mp4.
window.SITE_DATA = {
  cover: 'assets/bocchi-cover.png',
  coverAlt: '后藤一里穿粉色运动服，抱着黑色吉他坐在紫色灯光的排练室里',
  gallery: [
    { id: 'quiet-guitar', category: 'illustration', src: 'assets/bocchi-cover.png', title: '把心事，弹给夜晚听', subtitle: 'GUITAR DIARY / 001', tag: '同人插画', alt: '后藤一里穿粉色运动服，抱着吉他坐在昏暗的排练室中', credit: 'AI 生成同人插画 · 非官方素材' },
    { id: 'pink-frequency', category: 'poster', src: 'assets/pink-frequency.svg', title: '今天的频率，是粉色', subtitle: 'PINK FREQUENCY / 002', tag: '设计海报', alt: '粉色底的后藤一里主题排版海报，蓝黄发饰与吉他琴弦图形', credit: '本站原创图形海报 · 非官方设计' },
    { id: 'live-ticket', category: 'poster', src: 'assets/live-ticket.svg', title: '下一站，Live House', subtitle: 'KEEP ROCKING / 003', tag: '设计海报', alt: '深紫色与荧光黄的音乐现场主题票根海报', credit: '本站原创图形海报 · 非官方设计' }
  ],
  video: { src: '', title: '我的珍藏片段', description: '想再看一遍的瞬间。', poster: '' }
};
