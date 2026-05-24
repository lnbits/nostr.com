import { base } from '$app/paths';

export function appPath(path = '/') {
  if (!path || path === '/') return `${base}/`;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
