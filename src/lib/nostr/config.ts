import type { CustomFeedSettings, RelayState } from './types';

export const defaultRelays: RelayState[] = [
  { url: 'wss://relay.nostr.com', enabled: true, read: true, write: true, score: 98 },
  { url: 'wss://relay.damus.io', enabled: true, read: true, write: false, score: 86 },
  { url: 'wss://nos.lol', enabled: true, read: true, write: true, score: 84 },
  { url: 'wss://relay.primal.net', enabled: true, read: true, write: false, score: 82 }
];

export const defaultCustomFeedSettings: CustomFeedSettings = {
  friendsOfFriends: false,
  keywords: []
};

export const defaultGuestNip05 = 'benarc@nostr.com';

export const mutedWords = ['airdrop', 'giveaway', 'free sats now'];
