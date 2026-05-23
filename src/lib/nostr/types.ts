export type FeedMode = 'follow' | 'global' | 'custom';
export type LoginMode = 'nip07' | 'private-key' | 'bunker';

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
  name?: string;
  display_name?: string;
  picture?: string;
  banner?: string;
  about?: string;
  nip05?: string;
  lud16?: string;
  lud06?: string;
  website?: string;
}

export interface RelayState {
  url: string;
  enabled: boolean;
  read: boolean;
  write: boolean;
  score: number;
}

export interface ContactListDetails {
  pubkeys: string[];
  relayHints: string[];
}

export interface Nip05Profile {
  pubkey: string;
  relayHints: string[];
}

export interface CustomFeedSettings {
  friendsOfFriends: boolean;
  keywords: string[];
}

export interface Session {
  pubkey: string;
  mode: LoginMode;
  secret?: string;
  bunker?: string;
}

export interface NotificationItem {
  id: string;
  type: 'reply' | 'repost' | 'like' | 'zap' | 'mention';
  event: NostrEvent;
  seen: boolean;
}

export interface DirectMessage {
  id: string;
  protocol: 'NIP-04' | 'NIP-26' | 'NIP-4e';
  peer: string;
  from: string;
  to: string;
  created_at: number;
  encrypted: string;
  content?: string;
  delegated: boolean;
}
