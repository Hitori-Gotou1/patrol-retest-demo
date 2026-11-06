// Only the current selection may publish a result, including after decode().
export function createProgressiveImage({ onChange, createImage = () => new Image() }) {
  let active;

  function cancel() {
    const previous = active;
    active = undefined;
    if (!previous) return;
    previous.image.onload = null;
    previous.image.onerror = null;
    // Release an unfinished request where the browser permits it. The identity
    // check below also protects promises that have already started decoding.
    previous.image.removeAttribute('src');
  }

  function publish(request, changes) {
    if (active !== request) return;
    request.state = { ...request.state, ...changes };
    onChange(request.state);
  }

  function fail(request) {
    if (active !== request) return;
    request.fullFailed = true;
    const fallback = !request.previewFailed ? request.thumbnail : '';
    publish(request, { source: fallback || request.state.source, status: fallback ? 'fallback' : 'error', unavailable: !fallback });
  }

  function load(source, thumbnail) {
    cancel();
    const image = createImage();
    const request = active = {
      image, source, thumbnail: thumbnail && thumbnail !== source ? thumbnail : '',
      previewFailed: false, fullFailed: false, decoding: false,
      state: { source: thumbnail || source, status: 'loading', unavailable: false }
    };
    onChange(request.state);
    image.decoding = 'async';
    image.onload = async () => {
      if (active !== request || request.decoding || request.fullFailed) return;
      request.decoding = true;
      try {
        if (typeof image.decode === 'function') await image.decode();
        if (active === request && !request.fullFailed) publish(request, { source, status: 'ready', unavailable: false });
      } catch {
        fail(request);
      }
    };
    image.onerror = () => fail(request);
    image.src = source;
    // A memory-cached image can already be complete before a load event arrives.
    if (image.complete && image.naturalWidth > 0) image.onload();
  }

  function displayError(source) {
    const request = active;
    if (!request || source !== request.state.source) return;
    if (source === request.thumbnail) {
      request.previewFailed = true;
      publish(request, { unavailable: true, status: request.fullFailed ? 'error' : 'loading' });
    } else {
      fail(request);
    }
  }

  function clear() {
    cancel();
    onChange({ source: '', status: 'idle', unavailable: false });
  }

  return { load, clear, cancel, displayError };
}
