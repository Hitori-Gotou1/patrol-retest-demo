import { emptyPractice, practiceKey, validatePractice } from './practice.js';
// Web Locks serializes read/modify/write across tabs. The bounded storage lease is
// the fallback for browsers without Web Locks; no active timer is duplicated.
const lockName = `${practiceKey}:transaction`, leaseKey = `${practiceKey}:lease`;
export async function practiceTransaction(change, { storage = globalThis.localStorage, locks = globalThis.navigator?.locks } = {}) {
  const apply = () => {
    const raw = storage.getItem(practiceKey);
    let current;
    try { current = raw ? validatePractice(JSON.parse(raw)) : structuredClone(emptyPractice); }
    catch { throw new Error('本机练习记录暂时无法读取，原记录已保留。请先导出检查。'); }
    const next = validatePractice(change(current));
    storage.setItem(practiceKey, JSON.stringify(next));
    return next;
  };
  if (locks?.request) return locks.request(lockName, apply);
  const owner = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  for (let attempt = 0; attempt < 8; attempt++) {
    let lease;
    try { lease = JSON.parse(storage.getItem(leaseKey) || 'null'); } catch { lease = null; }
    if (!lease || lease.expires < Date.now()) {
      storage.setItem(leaseKey, JSON.stringify({ owner, expires: Date.now() + 3000 }));
      await new Promise(resolve => setTimeout(resolve, 25 + Math.random() * 20));
      try { lease = JSON.parse(storage.getItem(leaseKey) || 'null'); } catch { lease = null; }
      if (lease?.owner === owner) {
        try { return apply(); }
        finally { try { if (JSON.parse(storage.getItem(leaseKey) || 'null')?.owner === owner) storage.removeItem(leaseKey); } catch { /* Lease expires naturally. */ } }
      }
    }
    await new Promise(resolve => setTimeout(resolve, 45 + Math.random() * 30));
  }
  throw new Error('另一个标签页正在更新练习记录，请稍后重试。');
}
