const mediaUrlPattern = /https?:\/\/[^\s<>"']+\.(?:png|jpe?g|gif|webp|avif|mp4|webm|mov)(?:\?[^\s<>"']*)?/gi;
const hashtagPattern = /(^|[\s([{"'])#([A-Za-z0-9_]{2,64})/g;

export function extractMediaUrls(content: string) {
  return [...new Set(content.match(mediaUrlPattern) ?? [])];
}

export function isVideoUrl(url: string) {
  return /\.(mp4|webm|mov)(?:\?|$)/i.test(url);
}

export type NoteTextPart = { type: 'text'; value: string } | { type: 'hashtag'; value: string };

export function parseHashtags(content: string): NoteTextPart[] {
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
