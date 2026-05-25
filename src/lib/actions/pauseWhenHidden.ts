export function pauseWhenHidden(node: HTMLVideoElement) {
  if (typeof IntersectionObserver === 'undefined') return {};

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry?.isIntersecting || entry.intersectionRatio < 0.15) node.pause();
    },
    { threshold: [0, 0.15] }
  );

  observer.observe(node);

  return {
    destroy() {
      observer.disconnect();
      node.pause();
    }
  };
}
