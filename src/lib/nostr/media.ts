import { nip19 } from 'nostr-tools';
import type { MediaAttachment, NostrEvent } from './types';

const mediaUrlPattern = /https?:\/\/[^\s<>"']+\.(?:png|jpe?g|gif|webp|avif|mp4|webm|mov)(?:\?[^\s<>"']*)?/gi;
const webUrlPattern = /https?:\/\/[^\s<>"']+/gi;
const bareDomainPattern = /(^|[\s([{"'])([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+(?:\/[^\s<>"']*)?)/gi;
const hashtagPattern = /(^|[\s([{"'])#([A-Za-z0-9_]{2,64})/g;
const nostrRefPattern = /(?:nostr:)?((?:npub|nprofile|note|nevent)1[023456789acdefghjklmnpqrstuvwxyz]+)/gi;
const indexedRefPattern = /#\[(\d+)]/g;
const mentionPattern = /(^|[\s([{"'])(@([A-Za-z0-9_.-]{2,64})(?:\/([A-Za-z0-9:_-]{4,128}))?)/g;

export function extractMediaUrls(content: string) {
  return [...new Set(content.match(mediaUrlPattern) ?? [])];
}

export function isVideoUrl(url: string) {
  return /\.(mp4|webm|mov)(?:\?|$)/i.test(url);
}

export function extractMediaAttachments(event: NostrEvent): MediaAttachment[] {
  const byUrl = new Map<string, MediaAttachment>();
  for (const url of extractMediaUrls(event.content)) byUrl.set(url, { url, type: isVideoUrl(url) ? 'video' : 'image', fallbackUrls: [] });

  for (const tag of event.tags) {
    if (tag[0] !== 'imeta') continue;
    const metadata = parseImeta(tag);
    if (!metadata.url) continue;
    const attachment = byUrl.get(metadata.url) ?? { url: metadata.url, type: isVideoUrl(metadata.url) ? 'video' : 'image', fallbackUrls: [] };
    byUrl.set(metadata.url, { ...attachment, ...metadata, fallbackUrls: metadata.fallbackUrls ?? attachment.fallbackUrls });
  }

  return [...byUrl.values()];
}

export type NoteTextPart =
  | { type: 'text'; value: string }
  | { type: 'hashtag'; value: string }
  | { type: 'nostr'; value: string; href: string; label: string }
  | { type: 'mention'; value: string; href: string }
  | { type: 'link'; value: string; href: string };

export interface QuotedNoteReference {
  id: string;
  raw: string;
}

export function extractQuotedNoteReferences(content: string, tags: string[][] = []): QuotedNoteReference[] {
  const refs = new Map<string, QuotedNoteReference>();
  let match: RegExpExecArray | null;
  nostrRefPattern.lastIndex = 0;
  while ((match = nostrRefPattern.exec(content))) {
    const id = noteIdForNostrReference(match[1]);
    if (id) refs.set(id, { id, raw: match[0] });
  }

  indexedRefPattern.lastIndex = 0;
  while ((match = indexedRefPattern.exec(content))) {
    const tag = tags[Number(match[1])];
    if (tag?.[0] === 'e' && /^[0-9a-f]{64}$/i.test(tag[1])) refs.set(tag[1], { id: tag[1], raw: match[0] });
  }

  return [...refs.values()];
}

export function parseHashtags(content: string): NoteTextPart[] {
  return parseNoteText(content);
}

export function parseNoteText(content: string, hiddenUrls: string[] = [], tags: string[][] = []): NoteTextPart[] {
  const cleanContent = stripHiddenUrls(content, hiddenUrls);
  const hashtagParts = parseHashtagOnly(cleanContent);
  return hashtagParts.flatMap((part) => (part.type === 'text' ? parseReferences(part.value, tags) : [part]));
}

function parseHashtagOnly(content: string): NoteTextPart[] {
  const parts: NoteTextPart[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  hashtagPattern.lastIndex = 0;

  while ((match = hashtagPattern.exec(content))) {
    const prefix = match[1] ?? '';
    const tag = match[2];
    const hashIndex = match.index + prefix.length;
    if (hashIndex > lastIndex) parts.push({ type: 'text', value: content.slice(lastIndex, hashIndex) });
    parts.push({ type: 'hashtag', value: tag });
    lastIndex = hashIndex + tag.length + 1;
  }

  if (lastIndex < content.length) parts.push({ type: 'text', value: content.slice(lastIndex) });
  return parts.length ? parts : [{ type: 'text', value: content }];
}

function parseReferences(content: string, tags: string[][]): NoteTextPart[] {
  return parseWebLinks(content)
    .flatMap((part) => (part.type === 'text' ? parseBareDomainLinks(part.value) : [part]))
    .flatMap((part) => (part.type === 'text' ? parseNostrReferencesOnly(part.value, tags) : [part]))
    .flatMap((part) => (part.type === 'text' ? parseMentions(part.value) : [part]));
}

function parseWebLinks(content: string): NoteTextPart[] {
  const parts: NoteTextPart[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  webUrlPattern.lastIndex = 0;

  while ((match = webUrlPattern.exec(content))) {
    if (match.index > lastIndex) parts.push({ type: 'text', value: content.slice(lastIndex, match.index) });
    const url = trimTrailingUrlPunctuation(match[0]);
    parts.push({ type: 'link', value: url, href: url });
    lastIndex = match.index + url.length;
  }

  if (lastIndex < content.length) parts.push({ type: 'text', value: content.slice(lastIndex) });
  return parts.length ? parts : [{ type: 'text', value: content }];
}

function parseBareDomainLinks(content: string): NoteTextPart[] {
  const parts: NoteTextPart[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  bareDomainPattern.lastIndex = 0;

  while ((match = bareDomainPattern.exec(content))) {
    const prefix = match[1] ?? '';
    const raw = match[2];
    const urlIndex = match.index + prefix.length;
    if (!looksLikeDomainUrl(raw)) continue;
    if (urlIndex > lastIndex) parts.push({ type: 'text', value: content.slice(lastIndex, urlIndex) });
    const url = trimTrailingUrlPunctuation(raw);
    parts.push({ type: 'link', value: url, href: `https://${url}` });
    lastIndex = urlIndex + url.length;
  }

  if (lastIndex < content.length) parts.push({ type: 'text', value: content.slice(lastIndex) });
  return parts.length ? parts : [{ type: 'text', value: content }];
}

function parseNostrReferencesOnly(content: string, tags: string[][]): NoteTextPart[] {
  return parseNip19References(content).flatMap((part) => (part.type === 'text' ? parseIndexedReferences(part.value, tags) : [part]));
}

function parseNip19References(content: string): NoteTextPart[] {
  const parts: NoteTextPart[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  nostrRefPattern.lastIndex = 0;

  while ((match = nostrRefPattern.exec(content))) {
    if (match.index > lastIndex) parts.push({ type: 'text', value: content.slice(lastIndex, match.index) });
    const raw = match[0];
    parts.push({ type: 'nostr', value: raw, href: hrefForNostrReference(match[1]), label: labelForNostrReference(match[1]) });
    lastIndex = match.index + raw.length;
  }

  if (lastIndex < content.length) parts.push({ type: 'text', value: content.slice(lastIndex) });
  return parts.length ? parts : [{ type: 'text', value: content }];
}

function parseIndexedReferences(content: string, tags: string[][]): NoteTextPart[] {
  const parts: NoteTextPart[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  indexedRefPattern.lastIndex = 0;

  while ((match = indexedRefPattern.exec(content))) {
    if (match.index > lastIndex) parts.push({ type: 'text', value: content.slice(lastIndex, match.index) });
    const tag = tags[Number(match[1])];
    parts.push(indexedReferencePart(match[0], tag));
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) parts.push({ type: 'text', value: content.slice(lastIndex) });
  return parts.length ? parts : [{ type: 'text', value: content }];
}

function parseMentions(content: string): NoteTextPart[] {
  const parts: NoteTextPart[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  mentionPattern.lastIndex = 0;

  while ((match = mentionPattern.exec(content))) {
    const prefix = match[1] ?? '';
    const raw = match[2];
    const handle = match[3];
    const noteId = match[4];
    const mentionIndex = match.index + prefix.length;
    if (mentionIndex > lastIndex) parts.push({ type: 'text', value: content.slice(lastIndex, mentionIndex) });
    const query = noteId ? `?note=${encodeURIComponent(noteId)}` : '';
    parts.push({ type: 'mention', value: raw, href: `/profile/${encodeURIComponent(handle)}${query}` });
    lastIndex = mentionIndex + raw.length;
  }

  if (lastIndex < content.length) parts.push({ type: 'text', value: content.slice(lastIndex) });
  return parts.length ? parts : [{ type: 'text', value: content }];
}

function indexedReferencePart(raw: string, tag: string[] | undefined): NoteTextPart {
  if (!tag || !tag[1]) return { type: 'text', value: raw };
  if (tag[0] === 'p') return { type: 'nostr', value: raw, href: `/profile/${tag[1]}`, label: '@nostr' };
  if (tag[0] === 'e') return { type: 'nostr', value: raw, href: `/thread/${tag[1]}`, label: 'note' };
  return { type: 'text', value: raw };
}

function stripHiddenUrls(content: string, hiddenUrls: string[]) {
  return hiddenUrls.reduce((text, url) => text.replaceAll(url, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(), content);
}

function trimTrailingUrlPunctuation(url: string) {
  return url.replace(/[),.;!?]+$/g, '');
}

function looksLikeDomainUrl(value: string) {
  const host = trimTrailingUrlPunctuation(value).split('/')[0];
  const finalLabel = host.split('.').at(-1) ?? '';
  return /^[a-z]{2,}$/i.test(finalLabel) && /[a-z]/i.test(host);
}

function parseImeta(tag: string[]) {
  const metadata: Partial<MediaAttachment> = { fallbackUrls: [] };
  for (const field of tag.slice(1)) {
    const [key, ...rest] = field.split(' ');
    const value = rest.join(' ').trim();
    if (!value) continue;
    if (key === 'url') metadata.url = value;
    if (key === 'alt') metadata.alt = value;
    if (key === 'blurhash') metadata.blurhash = value;
    if (key === 'dim') metadata.dim = value;
    if (key === 'fallback') metadata.fallbackUrls = [...(metadata.fallbackUrls ?? []), value];
  }
  if (metadata.url) metadata.type = isVideoUrl(metadata.url) ? 'video' : 'image';
  return metadata;
}

function hrefForNostrReference(value: string) {
  try {
    const decoded = nip19.decode(value);
    if (decoded.type === 'npub') return `/profile/${decoded.data}`;
    if (decoded.type === 'nprofile') return `/profile/${decoded.data.pubkey}`;
    if (decoded.type === 'note') return `/thread/${decoded.data}`;
    if (decoded.type === 'nevent') return `/thread/${decoded.data.id}`;
  } catch {
    // Leave unknown or future NIP-19 values as external nostr URIs.
  }
  return `nostr:${value}`;
}

function labelForNostrReference(value: string) {
  try {
    const decoded = nip19.decode(value);
    if (decoded.type === 'npub' || decoded.type === 'nprofile') return '@nostr';
    if (decoded.type === 'note' || decoded.type === 'nevent') return 'note';
  } catch {
    // fall through
  }
  return `nostr:${value.slice(0, 12)}...`;
}

function noteIdForNostrReference(value: string) {
  try {
    const decoded = nip19.decode(value);
    if (decoded.type === 'note') return decoded.data;
    if (decoded.type === 'nevent') return decoded.data.id;
  } catch {
    // not a note reference
  }
  return '';
}
