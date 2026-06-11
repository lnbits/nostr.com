import { describe, expect, it } from 'vitest';
import { getPublicKey, nip19 } from 'nostr-tools';
import { validateImportedNsec } from './pomegranateAuth';

describe('Pomegranate auth adapter', () => {
  it('validates an imported nsec and derives the matching npub', () => {
    const secretKey = new Uint8Array(32).fill(7);
    const result = validateImportedNsec(nip19.nsecEncode(secretKey));

    expect(result.pubkey).toBe(getPublicKey(secretKey));
    expect(result.npub).toBe(nip19.npubEncode(result.pubkey));
  });

  it('rejects non-nsec import input', () => {
    expect(() => validateImportedNsec('npub1not-a-private-key')).toThrow('valid nsec');
  });
});
