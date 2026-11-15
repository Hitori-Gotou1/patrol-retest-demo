import { reactive } from 'vue';

export const appRecovery = reactive({ loading: false, issue: null, pendingRoute: null });
export function explainLoadError(error) {
  const chunk = /dynamically imported|Loading (?:CSS )?chunk|Failed to fetch|Importing a module|module script|Unable to preload/i.test(String(error?.message || error));
  return { kind: chunk ? 'version' : 'page', message: chunk ? '这一页的资源没有载入，可能是网络中断，或网站刚刚更新。重试后仍无法打开时，可以刷新网站版本。' : '这一页暂时没有准备好。可以重试；你保存在本机的作品和草稿会保留。' };
}
export function reportAppError(error, route) {
  appRecovery.loading = false;
  appRecovery.issue = explainLoadError(error);
  appRecovery.pendingRoute = route?.fullPath || null;
  console.error('[一里小屋] 页面加载失败', error);
}
export function connectRouterRecovery(router) {
  router.beforeEach(() => { appRecovery.loading = true; });
  router.afterEach((_to, _from, failure) => { appRecovery.loading = false; if (!failure) appRecovery.issue = null; });
  router.onError((error, to) => reportAppError(error, to));
}
