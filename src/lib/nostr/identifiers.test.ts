import { nip19 } from 'nostr-tools';
import { eventPointerFromIdentifier, profilePointerFromIdentifier } from './identifiers';

describe('NIP-19 identifiers', () => {
  it('resolves note and nevent identifiers to event pointers', () => {
    const id = 'a'.repeat(64);
    const nevent = nip19.neventEncode({ id, relays: ['wss://relay.example'], author: 'b'.repeat(64), kind: 1 });

    expect(eventPointerFromIdentifier(id)).toEqual({ id, relays: [] });
    expect(eventPointerFromIdentifier(nip19.noteEncode(id))).toEqual({ id, relays: [] });
    expect(eventPointerFromIdentifier(nevent)).toEqual({ id, relays: ['wss://relay.example'], author: 'b'.repeat(64), kind: 1 });
  });

  it('resolves npub and nprofile identifiers to profile pointers', () => {
    const pubkey = 'c'.repeat(64);
    const nprofile = nip19.nprofileEncode({ pubkey, relays: ['wss://relay.example'] });

    expect(profilePointerFromIdentifier(pubkey)).toEqual({ pubkey, relays: [] });
    expect(profilePointerFromIdentifier(nip19.npubEncode(pubkey))).toEqual({ pubkey, relays: [] });
    expect(profilePointerFromIdentifier(nprofile)).toEqual({ pubkey, relays: ['wss://relay.example'] });
  });
});
