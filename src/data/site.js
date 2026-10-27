export const assetUrl = (path) => `${import.meta.env.BASE_URL}${path}`;
export const site = {
  title: '一里小屋 · HITORI ROOM',
  cover: 'assets/bocchi-cover.webp',
  coverAlt: '后藤一里抱着吉他坐在紫粉色灯光中，本站 AI 同人插画',
  // 填入已获授权的本地视频路径后启用；留空时使用插画与舞台灯光动画。
  backgroundVideo: '',
  video: { src: '', title: '我的珍藏片段', description: '想再看一遍的瞬间。', poster: '' }
};
