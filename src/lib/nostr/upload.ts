import { getNip98AuthorizationHeader } from './client';
import type { Session } from './types';

export type NostrBuildMediaType = 'avatar' | 'banner' | 'media';

const nostrBuildUploadUrl = 'https://nostr.build/api/v2/upload/files';

export async function uploadToNostrBuild(session: Session, file: File, mediaType: NostrBuildMediaType = 'media') {
  const form = new FormData();
  form.set('file', file);
  form.set('media_type', mediaType);
  form.set('content_type', file.type);
  form.set('size', String(file.size));

  const authorization = await getNip98AuthorizationHeader(session, nostrBuildUploadUrl, 'POST');
  const desktopUploadUrl = await uploadWithDesktopBridge(file, mediaType, authorization);
  if (desktopUploadUrl) return desktopUploadUrl;

  const response = await fetch(nostrBuildUploadUrl, {
    method: 'POST',
    headers: { Authorization: authorization },
    body: form
  }).catch((err) => {
    throw new Error(uploadNetworkErrorMessage(err));
  });
  const data = await parseUploadResponse(response);
  if (!response.ok) throw new Error(uploadErrorMessage(data) || `Upload failed with ${response.status}.`);

  const url = uploadResponseUrl(data) || response.headers.get('location') || '';
  if (!url) throw new Error('Upload finished but no media URL was returned.');
  return url;
}

async function uploadWithDesktopBridge(file: File, mediaType: NostrBuildMediaType, authorization: string) {
  if (typeof window === 'undefined') return '';
  const bridge = window.nostrDesktopUpload;
  if (!bridge?.uploadToNostrBuild) return '';

  const result = await bridge
    .uploadToNostrBuild({
      name: file.name,
      type: file.type,
      size: file.size,
      mediaType,
      authorization,
      bytes: await file.arrayBuffer()
    })
    .catch((err) => {
      throw new Error(uploadNetworkErrorMessage(err));
    });

  if (!result.ok) throw new Error(result.error || uploadErrorMessage(result.data) || `Upload failed with ${result.status}.`);
  const url = uploadResponseUrl(result.data) || result.location || '';
  if (!url) throw new Error('Upload finished but no media URL was returned.');
  return url;
}

export function uploadResponseUrl(data: unknown): string {
  const tags = uploadResponseTags(data);
  const urlTag = tags.find((tag) => tag[0] === 'url' && tag[1]);
  if (urlTag?.[1] && isHttpUrl(urlTag[1])) return urlTag[1];
  if (typeof data === 'string') return extractUrl(data);
  if (Array.isArray(data)) {
    for (const item of data) {
      const url = uploadResponseUrl(item);
      if (url) return url;
    }
  }
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    for (const key of ['url', 'href', 'uri', 'download_url', 'downloadUrl', 'mediaUrl', 'fileUrl']) {
      const value = record[key];
      if (typeof value === 'string' && isHttpUrl(value)) return value;
    }
    for (const value of Object.values(record)) {
      const url = uploadResponseUrl(value);
      if (url) return url;
    }
  }
  return '';
}

function uploadResponseTags(data: unknown): string[][] {
  if (Array.isArray(data) && Array.isArray(data[0])) return data as string[][];
  if (!data || typeof data !== 'object') return [];
  const record = data as Record<string, unknown>;
  if (Array.isArray(record.tags)) return record.tags as string[][];
  if (record.nip94_event && typeof record.nip94_event === 'object' && Array.isArray((record.nip94_event as Record<string, unknown>).tags)) {
    return (record.nip94_event as { tags: string[][] }).tags;
  }
  if (record.data && typeof record.data === 'object') return uploadResponseTags(record.data);
  return [];
}

function uploadErrorMessage(data: unknown) {
  return data && typeof data === 'object' && 'message' in data && typeof data.message === 'string' ? data.message : '';
}

function uploadNetworkErrorMessage(err: unknown) {
  const detail = err instanceof Error && err.message ? ` ${err.message}` : '';
  return `Could not reach nostr.build for upload. This is usually a network, CORS, or browser-blocking issue.${detail}`;
}

async function parseUploadResponse(response: Response) {
  const json = await response
    .clone()
    .json()
    .catch(() => null);
  if (json) return json;
  return response.text().catch(() => '');
}

function extractUrl(value: string) {
  const [url] = value.match(/https?:\/\/[^\s<>"']+/i) ?? [];
  return url && isHttpUrl(url) ? url : '';
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}
