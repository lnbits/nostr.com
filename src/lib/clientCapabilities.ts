import { browser } from '$app/environment';

export function prefersLeanMedia() {
  if (!browser) return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return Boolean(
    connection?.saveData ||
      ['slow-2g', '2g', '3g'].includes(connection?.effectiveType ?? '') ||
      window.matchMedia('(hover: none) and (pointer: coarse)').matches
  );
}

export function lazyContentRootMargin() {
  return prefersLeanMedia() ? '360px 0px' : '900px 0px';
}
