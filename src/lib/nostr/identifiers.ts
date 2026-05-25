import { nip19 } from 'nostr-tools';

export interface EventPointer {
  id: string;
  relays: string[];
  author?: string;
  kind?: number;
}

export interface ProfilePointer {
  pubkey: string;
  relays: string[];
}

export function eventPointerFromIdentifier(value: string): EventPointer | null {
  const clean = value.trim();
  if (/^[0-9a-f]{64}$/i.test(clean)) return { id: clean.toLowerCase(), relays: [] };

  try {
    const decoded = nip19.decode(clean);
    if (decoded.type === 'note') return { id: decoded.data, relays: [] };
    if (decoded.type === 'nevent') {
      return {
        id: decoded.data.id,
        relays: decoded.data.relays ?? [],
        author: decoded.data.author,
        kind: decoded.data.kind
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function profilePointerFromIdentifier(value: string): ProfilePointer | null {
  const clean = value.trim();
  if (/^[0-9a-f]{64}$/i.test(clean)) return { pubkey: clean.toLowerCase(), relays: [] };

  try {
    const decoded = nip19.decode(clean);
    if (decoded.type === 'npub') return { pubkey: decoded.data, relays: [] };
    if (decoded.type === 'nprofile') return { pubkey: decoded.data.pubkey, relays: decoded.data.relays ?? [] };
  } catch {
    return null;
  }

  return null;
}
