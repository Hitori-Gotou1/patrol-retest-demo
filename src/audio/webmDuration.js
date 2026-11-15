// MediaRecorder writes streaming WebM without a Duration field. Add the real
// recording duration to Segment/Info so exported files can seek and show length.
function element(bytes, at) {
  const vint = (offset, id = false) => {
    const first = bytes[offset]; if (!first) throw new Error('Invalid EBML');
    let width = 1, bit = 128; while (!(first & bit) && width <= 8) { width++; bit >>= 1; }
    if (offset + width > bytes.length || width > 8) throw new Error('Invalid EBML');
    let value = id ? first : first & (bit - 1), unknown = !id && value === bit - 1;
    for (let i = 1; i < width; i++) { value = value * 256 + bytes[offset + i]; unknown = unknown && bytes[offset + i] === 255; }
    return { value, width, unknown };
  };
  const id = vint(at, true), size = vint(at + id.width), start = at + id.width + size.width;
  return { id: id.value, start, end: size.unknown ? bytes.length : start + size.value, size, sizeAt: at + id.width };
}
function writeSize(bytes, at, width, value) {
  for (let i = width - 1; i >= 0; i--) { bytes[at + i] = value % 256; value = Math.floor(value / 256); }
  bytes[at] |= 1 << (8 - width);
}
export async function withWebmDuration(blob, seconds) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let segment, info;
  for (let at = 0; at < bytes.length;) { const item = element(bytes, at); if (item.id === 0x18538067) { segment = item; break; } if (item.end <= at) break; at = item.end; }
  if (!segment) throw new Error('无法读取浏览器生成的 WebM 文件。');
  for (let at = segment.start; at < segment.end;) { const item = element(bytes, at); if (item.id === 0x1549a966) { info = item; break; } if (item.end <= at) break; at = item.end; }
  if (!info || info.size.unknown) throw new Error('视频缺少有效的时间信息。');
  let scale = 1000000, existing;
  for (let at = info.start; at < info.end;) {
    const item = element(bytes, at);
    if (item.id === 0x2ad7b1) { scale = 0; for (let i = item.start; i < item.end; i++) scale = scale * 256 + bytes[i]; }
    if (item.id === 0x4489 && item.end - item.start === 8) existing = item.start;
    at = item.end;
  }
  const duration = seconds * 1e9 / scale;
  if (existing) { new DataView(bytes.buffer).setFloat64(existing, duration); return new Blob([bytes], { type: blob.type }); }
  const addition = new Uint8Array(11); addition.set([0x44, 0x89, 0x88]); new DataView(addition.buffer).setFloat64(3, duration);
  if (info.size.value + addition.length >= 2 ** (7 * info.size.width) - 1) throw new Error('视频时间信息过长，无法封装。');
  if (!segment.size.unknown && segment.size.value + addition.length >= 2 ** (7 * segment.size.width) - 1) throw new Error('视频容器大小超出支持范围。');
  const output = new Uint8Array(bytes.length + addition.length); output.set(bytes.subarray(0, info.end)); output.set(addition, info.end); output.set(bytes.subarray(info.end), info.end + addition.length);
  writeSize(output, info.sizeAt, info.size.width, info.size.value + addition.length);
  if (!segment.size.unknown) writeSize(output, segment.sizeAt, segment.size.width, segment.size.value + addition.length);
  return new Blob([output], { type: blob.type });
}
