import { onBeforeUnmount, ref } from 'vue';
import { clamp } from '../room/playroom.js';

export function useStageEditor(svg, objects, { width, height, minY = 70, maxY = height - 50, onClick = () => {} }) {
  const selectedKey = ref('');
  let gesture;
  function point(event) {
    const matrix = svg.value?.getScreenCTM();
    return matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : null;
  }
  function down(event, item) {
    if (event.button !== 0 || !event.isPrimary) return;
    const p = point(event); if (!p) return;
    selectedKey.value = item.key;
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture = { id: event.pointerId, item, x: p.x, y: p.y, originalX: item.x, originalY: item.y, moved: false };
  }
  function move(event) {
    if (!gesture || event.pointerId !== gesture.id) return;
    const p = point(event); if (!p) return;
    if (Math.hypot(p.x - gesture.x, p.y - gesture.y) > 5) gesture.moved = true;
    if (!gesture.moved) return;
    gesture.item.x = Math.round(clamp(gesture.originalX + p.x - gesture.x, 35, width - 35));
    gesture.item.y = Math.round(clamp(gesture.originalY + p.y - gesture.y, minY, maxY));
  }
  function up(event) {
    if (!gesture || gesture.id !== event.pointerId) return;
    const previous = gesture; gesture = null;
    if (!previous.moved && event.type !== 'pointercancel') onClick(previous.item);
  }
  function key(event, item) {
    selectedKey.value = item.key;
    const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (moves[event.key]) { event.preventDefault(); const [x, y] = moves[event.key]; item.x = clamp(item.x + x * (event.shiftKey ? 20 : 8), 35, width - 35); item.y = clamp(item.y + y * (event.shiftKey ? 20 : 8), minY, maxY); }
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick(item); }
  }
  function remove() { const index = objects.value.findIndex(o => o.key === selectedKey.value); if (index >= 0) objects.value.splice(index, 1); selectedKey.value = ''; }
  onBeforeUnmount(() => { gesture = null; });
  return { selectedKey, down, move, up, key, remove };
}
