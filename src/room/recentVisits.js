import { findActivity } from '../data/activityCatalog.js';
import { loadLocal, saveLocal } from './storage.js';
export const recentVisitsKey = 'hitori-room:recent-visits:v1';
export function readRecentVisits() {
  return loadLocal(recentVisitsKey, [], value => {
    if (!Array.isArray(value)) throw new Error();
    return value.filter(item => item && findActivity(item.path) && Number.isFinite(item.at)).slice(0, 8);
  });
}
export function rememberVisit(path) {
  if (findActivity(path)) saveLocal(recentVisitsKey, [{ path, at: Date.now() }, ...readRecentVisits().filter(item => item.path !== path)].slice(0, 8));
}
export const recentActivities = () => readRecentVisits().map(visit => ({ ...findActivity(visit.path), at: visit.at }));
