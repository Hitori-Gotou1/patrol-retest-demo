import { onBeforeUnmount, onMounted, ref } from 'vue';
import { activityFavoritesKey, readActivityFavorites, toggleActivityFavorite, moveActivityFavorite } from '../room/activityFavorites.js';
export function useActivityFavorites() {
  const favorites = ref(readActivityFavorites()), notice = ref('');
  const refresh = event => { if (!event?.key || event.key === activityFavoritesKey) favorites.value = readActivityFavorites(); };
  function toggle(id) { try { favorites.value = toggleActivityFavorite(id); notice.value = favorites.value.includes(id) ? '已加入常用活动。' : '已取消常用。'; } catch { notice.value = '浏览器暂时不能保存常用活动，请检查存储设置。'; } }
  function move(id, offset) { try { favorites.value = moveActivityFavorite(id, offset); } catch { notice.value = '排序暂未保存，请再试一次。'; } }
  onMounted(() => { window.addEventListener('storage', refresh); window.addEventListener('hitori:activity-favorites', refresh); });
  onBeforeUnmount(() => { window.removeEventListener('storage', refresh); window.removeEventListener('hitori:activity-favorites', refresh); });
  return { favorites, notice, toggle, move };
}
