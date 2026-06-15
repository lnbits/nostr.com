export type FeedMode = 'follow' | 'global' | 'custom';
export type LoginMode = 'nip07' | 'private-key' | 'bunker' | 'pomegranate';

export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig?: string;
}

export interface Profile {
  pubkey: string;
  updated_at?: number;
  name?: string;
  display_name?: string;
  picture?: string;
  banner?: string;
  about?: string;
  nip05?: string;
  lud16?: string;
  lud06?: string;
  website?: string;
  interests?: string[];
}

export interface RelayState {
  url: string;
  enabled: boolean;
  read: boolean;
  write: boolean;
  score: number;
  supportedNips?: number[];
  limitation?: Record<string, unknown>;
}

export interface ContactListDetails {
  pubkeys: string[];
  relayHints: string[];
  items: ContactListItem[];
  updatedAt?: number;
}

export interface ContactListItem {
  pubkey: string;
  relay?: string;
  petname?: string;
}

export interface Nip05Profile {
  pubkey: string;
  relayHints: string[];
}

export interface CustomFeedSettings {
  friendsOfFriends: boolean;
  keywords: string[];
  interests: string[];
}

export interface FeedQueryOptions {
  limit?: number;
  since?: number;
  until?: number;
  hashtag?: string;
  globalAuthors?: string[];
  customFriendsOfFriends?: string[];
}

export interface Session {
  pubkey: string;
  mode: LoginMode;
  secret?: string;
  bunker?: string;
  bunkerClientSecret?: string;
  bunkerRelays?: string[];
  bunkerRemotePubkey?: string;
  bunkerSecret?: string | null;
  pomegranateCentral?: string;
  pomegranateEmail?: string;
  pomegranateProfile?: string;
}

export interface NotificationItem {
  id: string;
  type: 'reply' | 'repost' | 'like' | 'mention' | 'follow';
  event: NostrEvent;
  targetEvent?: NostrEvent;
  targetId?: string;
  seen: boolean;
}

export interface DirectMessage {
  id: string;
  protocol: 'NIP-04' | 'NIP-17';
  peer: string;
  from: string;
  to: string;
  created_at: number;
  encrypted: string;
  content?: string;
}

export interface EventStats {
  replies: number;
  reposts: number;
  likes: number;
  zaps: number;
  zapSats: number;
  dislikes: number;
  emoji: number;
}

export interface MediaAttachment {
  url: string;
  type: 'image' | 'video';
  alt?: string;
  blurhash?: string;
  dim?: string;
  fallbackUrls: string[];
}
