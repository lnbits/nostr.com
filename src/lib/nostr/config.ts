import type { CustomFeedSettings, RelayState } from './types';

export const defaultRelays: RelayState[] = [
  { url: 'wss://relay.nostr.com', enabled: true, read: true, write: true, score: 98 },
  { url: 'wss://relay.damus.io', enabled: true, read: true, write: true, score: 94 },
  { url: 'wss://nos.lol', enabled: true, read: true, write: true, score: 92 },
  { url: 'wss://relay.primal.net', enabled: true, read: true, write: true, score: 90 },
  { url: 'wss://relay.nostr.band', enabled: true, read: true, write: true, score: 88 },
  { url: 'wss://relay.snort.social', enabled: true, read: true, write: false, score: 86 },
  { url: 'wss://nostr.wine', enabled: true, read: true, write: false, score: 84 },
  { url: 'wss://nostr.bitcoiner.social', enabled: true, read: true, write: false, score: 82 },
  { url: 'wss://relay.current.fyi', enabled: true, read: true, write: false, score: 80 },
  { url: 'wss://relay.wellorder.net', enabled: true, read: true, write: false, score: 78 }
];

export const defaultCustomFeedSettings: CustomFeedSettings = {
  friendsOfFriends: false,
  keywords: [],
  interests: []
};

export const globalFeedHashtags = ['technology', 'food', 'foodstr', 'music', 'musicstr', 'introductions'];

export const globalFeedCuratorPubkey = 'c1fc7771f5fa418fd3ac49221a18f19b42ccb7a663da8f04cbbf6c08c80d20b1';

export const socialInterests = [
  'art',
  'photography',
  'music',
  'food',
  'technology',
  'bitcoin',
  'nostr',
  'science',
  'books',
  'film',
  'gaming',
  'sports',
  'travel',
  'fitness',
  'nature',
  'fashion',
  'business',
  'politics',
  'education',
  'parenting'
];

export const interestHashtagMap: Record<string, string[]> = {
  art: ['art', 'artstr'],
  photography: ['photography', 'photostr'],
  music: ['music', 'musicstr'],
  food: ['food', 'foodstr'],
  nature: ['nature', 'naturestr']
};

export function keywordsForInterests(interests: string[]) {
  return [
    ...new Set(
      interests.flatMap((interest) => {
        const clean = interest.trim().toLowerCase();
        if (!clean) return [];
        return (interestHashtagMap[clean] ?? [clean]).map((tag) => `#${tag}`);
      })
    )
  ];
}

export const defaultGuestNip05 = 'benarc@nostr.com';

export const defaultPomegranateCentral = 'auth.njump.me';

export const defaultPomegranateOperators = ['po.njump.me', 'po.f7z.io', 'po.nostrver.se'];
