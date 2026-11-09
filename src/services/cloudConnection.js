export const cloudTimeoutMs = 12000;

// A request can stall before headers, while reading its body, or even ignore
// cancellation. Bound the whole operation and discard any late result.
export function withCloudDeadline(operation, { signal, timeoutMs = cloudTimeoutMs } = {}) {
  const controller = new AbortController();
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      callback(value);
    };
    const cancel = () => {
      const reason = signal.reason || new DOMException('Request cancelled', 'AbortError');
      controller.abort(reason);
      finish(reject, reason);
    };
    if (signal?.aborted) { cancel(); return; }
    signal?.addEventListener('abort', cancel, { once: true });
    timer = setTimeout(() => {
      const error = Object.assign(new Error('Cloud request timed out'), { code: 'CLOUD_TIMEOUT' });
      controller.abort(error);
      finish(reject, error);
    }, timeoutMs);
    Promise.resolve().then(() => settled ? undefined : operation(controller.signal)).then(
      value => finish(resolve, value), error => finish(reject, error)
    );
  });
}

export function fetchAuthWithDeadline(input, options = {}) {
  return withCloudDeadline(async signal => {
    const response = await fetch(input, { ...options, signal });
    // Keep the timeout active if headers arrive but the JSON body stalls.
    await response.clone().arrayBuffer();
    return response;
  }, { signal: options.signal || (input instanceof Request ? input.signal : undefined) });
}

export function cloudServiceMessage(error) {
  if (error?.code === 'CLOUD_TIMEOUT') return '连接云端服务超时（12 秒），请检查网络后重试。';
  if (globalThis.navigator?.onLine === false) return '设备当前处于离线状态，联网后可以重试。';
  if (error?.status === 401) return '服务验证未通过，请检查登录信息及项目公开连接参数。';
  if (error?.status === 403) return '云端服务拒绝了请求，请站主检查访问权限。';
  if (error?.status === 404 || ['PGRST205', '42P01'].includes(error?.code)) return '未找到云端收藏服务或数据表，请站主检查项目地址和 SQL 配置。';
  if (error?.status >= 500) return '云端服务暂时不可用，请稍后重试，并确认 Supabase 项目是否运行中。';
  return '无法连接云端服务，请检查网络，或确认 Supabase 项目是否运行中。';
}
