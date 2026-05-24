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

export const hateSpeechTerms = [
  '1488',
  'heil hitler',
  'white power',
  'gas the jews',
  "six million wasn't enough",
  'race traitor',
  'nigger',
  'nigga',
  'n1gger',
  'n1gga',
  'coon',
  'jigaboo',
  'porch monkey',
  'spic',
  'wetback',
  'beaner',
  'chink',
  'gook',
  'zipperhead',
  'kike',
  'yid',
  'paki',
  'raghead',
  'sand nigger',
  'towelhead',
  'gypsy scum',
  'faggot',
  'fag',
  'tranny',
  'trannie',
  'shemale',
  'dyke',
  'retard'
];

export const mutedWords = [
  'airdrop',
  'giveaway',
  'free sats now',
  'nsfw',
  'not safe for work',
  'porn',
  'porno',
  'pornography',
  'adult content',
  'explicit content',
  'sex tape',
  'sexcam',
  'camgirl',
  'onlyfans',
  'fansly',
  'nudes',
  'nude',
  'xxx',
  'hentai',
  'erotic',
  'escort',
  'hookup',
  'milf',
  'fetish',
  'bdsm',
  'teen',
  ...hateSpeechTerms
];

export const adultDomains = [
  'onlyfans.com',
  'fansly.com',
  'pornhub.com',
  'xvideos.com',
  'xnxx.com',
  'xhamster.com',
  'redtube.com',
  'youporn.com',
  'spankbang.com',
  'rule34',
  'e621.net',
  'booru'
];

export const adultHashtags = [
  'nsfw',
  'porn',
  'porno',
  'pornography',
  'adult',
  'nudes',
  'nude',
  'xxx',
  'hentai',
  'erotic',
  'onlyfans',
  'fansly',
  'fetish',
  'bdsm',
  'teen'
];
