import type { DirectMessage } from '$lib/nostr/types';

export function mergeDirectMessages(incoming: DirectMessage[], existing: DirectMessage[], ownPubkey = '') {
  const normalizedOwnPubkey = normalizePubkey(ownPubkey);
  const merged: DirectMessage[] = [];
  for (const message of [...existing, ...incoming]
    .map(normalizeDirectMessage)
    .filter((message): message is DirectMessage => Boolean(message && message.peer !== normalizedOwnPubkey))) {
    const index = merged.findIndex((existingMessage) => existingMessage.id === message.id || isSameDirectMessage(existingMessage, message));
    if (index >= 0) {
      merged[index] = preferDirectMessage(merged[index], message);
    } else {
      merged.push(message);
    }
  }
  return merged.sort((a, b) => b.created_at - a.created_at).slice(0, 400);
}

function normalizeDirectMessage(message: DirectMessage) {
  const peer = normalizePubkey(message.peer);
  const from = normalizePubkey(message.from);
  const to = message.to
    .split(',')
    .map(normalizePubkey)
    .filter(Boolean)
    .join(',');
  if (!peer || !from) return null;
  return { ...message, peer, from, to };
}

function isSameDirectMessage(a: DirectMessage, b: DirectMessage) {
  if (a.protocol !== b.protocol || a.peer !== b.peer || a.from !== b.from) return false;
  if (!a.content || a.content !== b.content) return false;
  return Math.abs(a.created_at - b.created_at) <= 3;
}

function preferDirectMessage(existing: DirectMessage, incoming: DirectMessage) {
  if (!existing.encrypted && incoming.encrypted) return incoming;
  if (!existing.content && incoming.content) return incoming;
  return existing;
}

function normalizePubkey(value: string) {
  const clean = value.trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(clean) ? clean : '';
}
