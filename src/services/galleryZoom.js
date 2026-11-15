export function fittedImageSize(width, height, availableWidth, availableHeight) {
  if (![width, height, availableWidth, availableHeight].every(value => Number.isFinite(value) && value > 0)) return { width: 0, height: 0 };
  const ratio = Math.min(1, availableWidth / width, availableHeight / height);
  return { width: width * ratio, height: height * ratio };
}
export function clampImagePan({ x, y, scale, width, height, availableWidth, availableHeight }) {
  const limitX = Math.max(0, (width * scale - availableWidth) / 2);
  const limitY = Math.max(0, (height * scale - availableHeight) / 2);
  return { x: Math.max(-limitX, Math.min(limitX, x)) || 0, y: Math.max(-limitY, Math.min(limitY, y)) || 0 };
}
