import { browser } from '$app/environment';

const storageKey = 'nostr-feed-scroll-state';

export interface FeedScrollState {
  scrollY: number;
  anchorId?: string;
  anchorOffset?: number;
  savedAt: number;
}

let memoryState: FeedScrollState | null = null;

export function saveFeedScrollState(state: Omit<FeedScrollState, 'savedAt'>) {
  const nextState = { ...state, savedAt: Date.now() };
  memoryState = nextState;
  if (!browser) return;
  sessionStorage.setItem(storageKey, JSON.stringify(nextState));
}

export function readFeedScrollState() {
  if (memoryState) return memoryState;
  if (!browser) return null;
  try {
    const parsed = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null') as FeedScrollState | null;
    memoryState = parsed;
    return parsed;
  } catch {
    return null;
  }
}

export function clearFeedScrollState() {
  memoryState = null;
  if (browser) sessionStorage.removeItem(storageKey);
}
