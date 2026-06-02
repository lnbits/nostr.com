import { browser } from '$app/environment';

const storageKey = 'nostr-thread-return-targets';
const maxTargets = 80;

let memoryTargets = new Map<string, string>();

export function saveThreadReturnTarget(threadId: string, target: string) {
  if (!/^[0-9a-f]{64}$/i.test(threadId) || !isLocalTarget(target)) return;
  memoryTargets.set(threadId, target);
  while (memoryTargets.size > maxTargets) {
    const [oldestKey] = memoryTargets.keys();
    memoryTargets.delete(oldestKey);
  }
  persistThreadReturnTargets();
}

export function readThreadReturnTarget(threadId: string) {
  if (!memoryTargets.size) memoryTargets = loadThreadReturnTargets();
  const target = memoryTargets.get(threadId);
  return target && isLocalTarget(target) ? target : '';
}

export function currentThreadReturnTarget(pathname: string, search = '', hash = '') {
  return `${pathname}${search}${hash}`;
}

function isLocalTarget(target: string) {
  return target.startsWith('/') && !target.startsWith('//');
}

function persistThreadReturnTargets() {
  if (!browser) return;
  sessionStorage.setItem(storageKey, JSON.stringify([...memoryTargets.entries()]));
}

function loadThreadReturnTargets() {
  if (!browser) return new Map<string, string>();
  try {
    const parsed = JSON.parse(sessionStorage.getItem(storageKey) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return new Map<string, string>();
    return new Map(
      parsed.filter(
        (entry): entry is [string, string] =>
          Array.isArray(entry) && /^[0-9a-f]{64}$/i.test(entry[0]) && typeof entry[1] === 'string' && isLocalTarget(entry[1])
      )
    );
  } catch {
    return new Map<string, string>();
  }
}
