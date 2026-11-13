import { validateCounts } from './analytics.js';

// Supabase caps individual responses; fetch every row in the retained period.
export async function fetchUsageCounts(client, { signal, now = Date.now() } = {}) {
  const since = new Date(now - 89 * 86400000).toISOString().slice(0, 10);
  const days = {};
  for (let offset = 0; offset < 10000; offset += 1000) {
    const { data, error } = await client.from('hitori_daily_events')
      .select('day,target_key,event_kind,count').gte('day', since)
      .order('day', { ascending: false }).order('target_key').order('event_kind')
      .range(offset, offset + 999).abortSignal(signal);
    if (error) throw new Error('统计表尚未就绪，请检查统计接口配置。');
    if (!Array.isArray(data)) throw new Error('统计数据无法读取。');
    for (const row of data) {
      days[row.day] ??= {};
      days[row.day][row.target_key] ??= { open: 0, complete: 0, export: 0 };
      days[row.day][row.target_key][row.event_kind] = row.count;
    }
    if (data.length < 1000) return validateCounts({ version: 1, days });
  }
  throw new Error('统计记录较多，请稍后重试。');
}
