import { browser } from '$app/environment';

const storageKey = 'nostr-route-scroll-states';
const maxStates = 120;

export interface RouteScrollState {
  scrollY: number;
  anchorId?: string;
  anchorOffset?: number;
  savedAt: number;
  exactUntil?: number;
}

let memoryStates = new Map<string, RouteScrollState>();

export function saveRouteScrollState(routeKey: string, state: Omit<RouteScrollState, 'savedAt' | 'exactUntil'>, options: { exact?: boolean } = {}) {
  if (!isLocalRouteKey(routeKey)) return;
  const now = Date.now();
  const existing = memoryStates.get(routeKey);
  if (!options.exact && existing?.exactUntil && existing.exactUntil > now) return;
  memoryStates.set(routeKey, { ...state, savedAt: now, exactUntil: options.exact ? now + 1500 : undefined });
  while (memoryStates.size > maxStates) {
    const [oldestKey] = memoryStates.keys();
    memoryStates.delete(oldestKey);
  }
  persistRouteScrollStates();
}

export function readRouteScrollState(routeKey: string) {
  if (!memoryStates.size) memoryStates = loadRouteScrollStates();
  return memoryStates.get(routeKey) ?? null;
}

function isLocalRouteKey(routeKey: string) {
  return routeKey.startsWith('/') && !routeKey.startsWith('//');
}

function persistRouteScrollStates() {
  if (!browser) return;
  sessionStorage.setItem(storageKey, JSON.stringify([...memoryStates.entries()]));
}

function loadRouteScrollStates() {
  if (!browser) return new Map<string, RouteScrollState>();
  try {
    const parsed = JSON.parse(sessionStorage.getItem(storageKey) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return new Map<string, RouteScrollState>();
    return new Map(
      parsed.filter(
        (entry): entry is [string, RouteScrollState] =>
          Array.isArray(entry) &&
          typeof entry[0] === 'string' &&
          isLocalRouteKey(entry[0]) &&
          Boolean(entry[1]) &&
          typeof entry[1] === 'object' &&
          typeof (entry[1] as RouteScrollState).scrollY === 'number' &&
          typeof (entry[1] as RouteScrollState).savedAt === 'number'
      )
    );
  } catch {
    return new Map<string, RouteScrollState>();
  }
}
