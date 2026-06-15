type PauseWhenHiddenOptions = {
  resetIframe?: boolean;
};

export function pauseWhenHidden(node: HTMLMediaElement | HTMLIFrameElement, options: PauseWhenHiddenOptions = {}) {
  if (typeof IntersectionObserver === 'undefined') return {};
  const iframeSource = node instanceof HTMLIFrameElement ? node.src : '';
  let iframeUnloaded = false;

  const observer = new IntersectionObserver(
    ([entry]) => {
      const visible = Boolean(entry?.isIntersecting && entry.intersectionRatio >= 0.15);
      if (visible) {
        restoreIframe(node, iframeSource, iframeUnloaded);
        iframeUnloaded = false;
        return;
      }
      if (node instanceof HTMLIFrameElement) {
        pauseIframe(node);
        if (options.resetIframe && node.src !== 'about:blank') {
          node.src = 'about:blank';
          iframeUnloaded = true;
        }
      } else {
        node.pause();
      }
    },
    { threshold: [0, 0.15] }
  );

  observer.observe(node);

  return {
    destroy() {
      observer.disconnect();
      if (node instanceof HTMLIFrameElement) pauseIframe(node);
      else node.pause();
    }
  };
}

function pauseIframe(node: HTMLIFrameElement) {
  const target = node.contentWindow;
  if (!target) return;
  target.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), '*');
  target.postMessage(JSON.stringify({ method: 'pause' }), '*');
}

function restoreIframe(node: HTMLMediaElement | HTMLIFrameElement, source: string, unloaded: boolean) {
  if (node instanceof HTMLIFrameElement && unloaded && source && node.src === 'about:blank') node.src = source;
}
