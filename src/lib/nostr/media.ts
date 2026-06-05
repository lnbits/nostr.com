import { nip19 } from 'nostr-tools';
import { appPath } from '$lib/paths';
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

function isImageUrl(url: string) {
  return /\.(png|jpe?g|gif|webp|avif)(?:\?|$)/i.test(url);
}

function mediaTypeForUrl(url: string, mime = ''): MediaAttachment['type'] | undefined {
  const cleanMime = mime.toLowerCase();
  if (cleanMime.startsWith('video/') || isVideoUrl(url)) return 'video';
  if (cleanMime.startsWith('image/') || isImageUrl(url)) return 'image';
  return undefined;
}

export function extractMediaAttachments(event: NostrEvent): MediaAttachment[] {
  const byUrl = new Map<string, MediaAttachment>();
  for (const url of extractMediaUrls(event.content)) byUrl.set(url, { url, type: isVideoUrl(url) ? 'video' : 'image', fallbackUrls: [] });

  for (const tag of event.tags) {
    if (tag[0] !== 'imeta') continue;
    const metadata = parseImeta(tag);
    if (!metadata.url || !metadata.type) continue;
    const attachment = byUrl.get(metadata.url) ?? { url: metadata.url, type: metadata.type, fallbackUrls: [] };
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

export interface SocialEmbed {
  provider: 'youtube' | 'vimeo' | 'instagram' | 'tiktok';
  url: string;
  embedUrl: string;
  title: string;
  aspect: 'video' | 'portrait' | 'square';
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

export function extractSocialEmbeds(content: string): SocialEmbed[] {
  const embeds = new Map<string, SocialEmbed>();
  for (const raw of extractWebUrls(content)) {
    const embed = socialEmbedForUrl(raw);
    if (embed) embeds.set(embed.url, embed);
  }
  return [...embeds.values()];
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

function extractWebUrls(content: string) {
  const urls: string[] = [];
  let match: RegExpExecArray | null;
  webUrlPattern.lastIndex = 0;
  while ((match = webUrlPattern.exec(content))) urls.push(trimTrailingUrlPunctuation(match[0]));
  return [...new Set(urls)];
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
    parts.push({ type: 'mention', value: raw, href: appPath(`/profile/${encodeURIComponent(handle)}${query}`) });
    lastIndex = mentionIndex + raw.length;
  }

  if (lastIndex < content.length) parts.push({ type: 'text', value: content.slice(lastIndex) });
  return parts.length ? parts : [{ type: 'text', value: content }];
}

function indexedReferencePart(raw: string, tag: string[] | undefined): NoteTextPart {
  if (!tag || !tag[1]) return { type: 'text', value: raw };
  if (tag[0] === 'p') return { type: 'nostr', value: raw, href: appPath(`/profile/${tag[1]}`), label: '@nostr' };
  if (tag[0] === 'e') return { type: 'nostr', value: raw, href: appPath(`/thread/${tag[1]}`), label: 'note' };
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
  let mime = '';
  for (const field of tag.slice(1)) {
    const [key, ...rest] = field.split(' ');
    const value = rest.join(' ').trim();
    if (!value) continue;
    if (key === 'url') metadata.url = safeHttpUrl(value);
    if (key === 'm') mime = value;
    if (key === 'alt') metadata.alt = value;
    if (key === 'blurhash') metadata.blurhash = value;
    if (key === 'dim') metadata.dim = value;
    if (key === 'fallback') {
      const fallbackUrl = safeHttpUrl(value);
      if (fallbackUrl) metadata.fallbackUrls = [...(metadata.fallbackUrls ?? []), fallbackUrl];
    }
  }
  if (metadata.url) metadata.type = mediaTypeForUrl(metadata.url, mime);
  return metadata;
}

function safeHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : '';
  } catch {
    return '';
  }
}

function socialEmbedForUrl(raw: string): SocialEmbed | null {
  const url = safeHttpUrl(raw);
  if (!url) return null;

  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  const pathParts = parsed.pathname.split('/').filter(Boolean);

  const youtubeId = youtubeVideoId(host, parsed, pathParts);
  if (youtubeId) {
    return {
      provider: 'youtube',
      url,
      embedUrl: `https://www.youtube-nocookie.com/embed/${youtubeId}`,
      title: 'YouTube video',
      aspect: 'video'
    };
  }

  const vimeoId = vimeoVideoId(host, pathParts);
  if (vimeoId) {
    return {
      provider: 'vimeo',
      url,
      embedUrl: `https://player.vimeo.com/video/${vimeoId}`,
      title: 'Vimeo video',
      aspect: 'video'
    };
  }

  const instagramCode = instagramShortcode(host, pathParts);
  if (instagramCode) {
    const kind = pathParts[0] === 'reel' ? 'reel' : 'post';
    return {
      provider: 'instagram',
      url,
      embedUrl: `https://www.instagram.com/${kind === 'reel' ? 'reel' : 'p'}/${instagramCode}/embed`,
      title: `Instagram ${kind}`,
      aspect: kind === 'reel' ? 'portrait' : 'square'
    };
  }

  const tiktokId = tiktokVideoId(host, pathParts);
  if (tiktokId) {
    return {
      provider: 'tiktok',
      url,
      embedUrl: `https://www.tiktok.com/embed/v2/${tiktokId}`,
      title: 'TikTok video',
      aspect: 'portrait'
    };
  }

  return null;
}

function youtubeVideoId(host: string, parsed: URL, pathParts: string[]) {
  if (host === 'youtu.be') return validEmbedId(pathParts[0]);
  if (!['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com'].includes(host)) return '';
  if (pathParts[0] === 'watch') return validEmbedId(parsed.searchParams.get('v') ?? '');
  if (['shorts', 'embed', 'live'].includes(pathParts[0])) return validEmbedId(pathParts[1]);
  return '';
}

function vimeoVideoId(host: string, pathParts: string[]) {
  if (host === 'player.vimeo.com' && pathParts[0] === 'video') return validNumericId(pathParts[1]);
  if (!host.endsWith('vimeo.com')) return '';
  return validNumericId(pathParts.find((part) => /^\d+$/.test(part)));
}

function instagramShortcode(host: string, pathParts: string[]) {
  if (!host.endsWith('instagram.com')) return '';
  if (!['p', 'reel', 'tv'].includes(pathParts[0])) return '';
  return validEmbedId(pathParts[1]);
}

function tiktokVideoId(host: string, pathParts: string[]) {
  if (!host.endsWith('tiktok.com')) return '';
  const videoIndex = pathParts.findIndex((part) => part === 'video');
  return videoIndex >= 0 ? validNumericId(pathParts[videoIndex + 1]) : '';
}

function validEmbedId(value = '') {
  return /^[A-Za-z0-9_-]{5,128}$/.test(value) ? value : '';
}

function validNumericId(value = '') {
  return /^\d{5,32}$/.test(value) ? value : '';
}

function hrefForNostrReference(value: string) {
  try {
    const decoded = nip19.decode(value);
    if (decoded.type === 'npub') return appPath(`/profile/${decoded.data}`);
    if (decoded.type === 'nprofile') return appPath(`/profile/${decoded.data.pubkey}`);
    if (decoded.type === 'note') return appPath(`/thread/${decoded.data}`);
    if (decoded.type === 'nevent') return appPath(`/thread/${value}`);
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
