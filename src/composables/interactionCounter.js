/** 冷却内的点击不计数；只保留时间窗口内的有效点击。时钟可注入以便测试。 */
export function createInteractionCounter(settings, now = () => performance.now()) {
  let clicks = [];
  let last = -Infinity;
  return {
    hit() {
      const time = now();
      if (time - last < settings.cooldownMs) return null;
      last = time;
      clicks = clicks.filter(stamp => time - stamp <= settings.windowMs);
      clicks.push(time);
      return clicks.length >= settings.boxAt ? 'box' : clicks.length >= settings.panicAt ? 'panic' : 'shy';
    },
    reset() { clicks = []; last = -Infinity; }
  };
}
