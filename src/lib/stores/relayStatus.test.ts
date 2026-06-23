import { loginRelaysReady } from './relayStatus';
import type { RelayState } from '$lib/nostr/types';

function relay(url: string, options: Partial<RelayState> = {}): RelayState {
  return {
    url,
    enabled: true,
    read: true,
    write: true,
    score: 0,
    ...options
  };
}

describe('relay status helpers', () => {
  it('requires an online read relay and an online write relay before login', () => {
    expect(loginRelaysReady([relay('wss://read.example', { write: false }), relay('wss://write.example', { read: false })], { 'wss://read.example': 'online' })).toBe(false);

    expect(
      loginRelaysReady([relay('wss://read.example', { write: false }), relay('wss://write.example', { read: false })], {
        'wss://read.example': 'online',
        'wss://write.example': 'online'
      })
    ).toBe(true);
  });

  it('ignores disabled relays when checking login readiness', () => {
    expect(loginRelaysReady([relay('wss://offline.example', { enabled: false }), relay('wss://online.example')], { 'wss://online.example': 'online' })).toBe(true);
  });

  it('does not allow login when there are no enabled relays', () => {
    expect(loginRelaysReady([], {})).toBe(false);
    expect(loginRelaysReady([relay('wss://disabled.example', { enabled: false })], { 'wss://disabled.example': 'online' })).toBe(false);
  });
});
