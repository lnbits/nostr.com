import { activeRelayUrls, signEventTemplate } from './client';
import type { NostrEvent, Profile, RelayState, Session } from './types';

const bech32Charset = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const bech32Generator = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
const zapInfoCache = new Map<string, ZapInfo | null>();

export interface ZapInfo {
  recipientPubkey: string;
  lnurl: string;
  callback: string;
  minSendable: number;
  maxSendable: number;
  supportsNostr: boolean;
  nostrPubkey?: string;
}

export interface ZapInvoice {
  invoice: string;
  zapRequest?: NostrEvent;
}

export async function loadZapInfo(event: NostrEvent, profile: Profile | undefined, relays: RelayState[]) {
  const target = zapTargetFromEvent(event, profile);
  if (!target) return null;

  const cacheKey = `${target.recipientPubkey}:${target.lnurl}`;
  if (zapInfoCache.has(cacheKey)) return zapInfoCache.get(cacheKey) ?? null;

  const response = await fetch(target.payUrl, { headers: { accept: 'application/json' } });
  if (!response.ok) {
    zapInfoCache.set(cacheKey, null);
    return null;
  }

  const data = (await response.json()) as Partial<LnurlPayResponse>;
  const callback = typeof data.callback === 'string' ? data.callback : '';
  const safeCallback = safeHttpUrl(callback);
  const nostrPubkey = typeof data.nostrPubkey === 'string' ? data.nostrPubkey : undefined;
  const minSendable = Number(data.minSendable);
  const maxSendable = Number(data.maxSendable);
  const supportsNostr = Boolean(data.allowsNostr) && Boolean(nostrPubkey && /^[0-9a-f]{64}$/i.test(nostrPubkey));
  const canPay = safeCallback && Number.isFinite(minSendable) && Number.isFinite(maxSendable);
  if (!canPay) {
    zapInfoCache.set(cacheKey, null);
    return null;
  }

  const info: ZapInfo = {
    recipientPubkey: target.recipientPubkey,
    lnurl: target.lnurl,
    callback: safeCallback,
    minSendable,
    maxSendable,
    supportsNostr,
    nostrPubkey
  };
  zapInfoCache.set(cacheKey, info);
  return info;
}

export async function createZapInvoice(session: Session, event: NostrEvent, info: ZapInfo, amountSats: number, relays: RelayState[]) {
  const amountMsats = Math.round(amountSats * 1000);
  if (!Number.isFinite(amountMsats) || amountMsats <= 0) throw new Error('Enter a zap amount.');
  if (amountMsats < info.minSendable) throw new Error(`Minimum zap is ${formatMsatsAsSats(info.minSendable)} sats.`);
  if (amountMsats > info.maxSendable) throw new Error(`Maximum zap is ${formatMsatsAsSats(info.maxSendable)} sats.`);

  const callbackUrl = new URL(info.callback);
  callbackUrl.searchParams.set('amount', String(amountMsats));

  let zapRequest: NostrEvent | undefined;
  if (info.supportsNostr) {
    const readRelays = activeRelayUrls(relays, 'read');
    const tags = [
      ['relays', ...readRelays],
      ['amount', String(amountMsats)],
      ['lnurl', info.lnurl],
      ['p', info.recipientPubkey],
      ['e', event.id],
      ['P', session.pubkey]
    ];
    zapRequest = (await signEventTemplate(session, {
      kind: 9734,
      content: '',
      tags,
      created_at: Math.floor(Date.now() / 1000)
    })) as unknown as NostrEvent;

    callbackUrl.searchParams.set('nostr', JSON.stringify(zapRequest));
    callbackUrl.searchParams.set('lnurl', info.lnurl);
  }

  const response = await fetch(callbackUrl, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error('Could not create a lightning invoice.');
  const data = (await response.json()) as { pr?: unknown; status?: string; reason?: string };
  if (typeof data.pr !== 'string' || !data.pr.trim()) throw new Error(data.reason || 'The zap service did not return an invoice.');
  return { invoice: data.pr, zapRequest };
}

export function lnurlPayUrlFromProfile(profile: Profile | undefined) {
  const lud06 = profile?.lud06?.trim();
  if (lud06) {
    const decoded = decodeLnurl(lud06);
    const safeDecoded = decoded ? safeHttpUrl(decoded) : '';
    if (safeDecoded) return safeDecoded;
  }

  const lud16 = profile?.lud16?.trim();
  if (!lud16 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lud16)) return null;
  const [name, domain] = lud16.split('@');
  return `https://${domain.toLowerCase()}/.well-known/lnurlp/${encodeURIComponent(name)}`;
}

export function encodeLnurl(url: string) {
  const data = convertBits([...new TextEncoder().encode(url)], 8, 5, true);
  return bech32Encode('lnurl', data);
}

export function decodeLnurl(value: string) {
  const decoded = bech32Decode(value);
  if (!decoded || decoded.hrp !== 'lnurl') return null;
  try {
    const bytes = convertBits(decoded.data, 5, 8, false);
    return new TextDecoder().decode(new Uint8Array(bytes));
  } catch {
    return null;
  }
}

function zapTargetFromEvent(event: NostrEvent, profile: Profile | undefined) {
  const payUrl = lnurlPayUrlFromProfile(profile);
  if (!payUrl) return null;
  return {
    recipientPubkey: event.pubkey,
    payUrl,
    lnurl: encodeLnurl(payUrl)
  };
}

function safeHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function formatMsatsAsSats(msats: number) {
  return Math.ceil(msats / 1000);
}

interface LnurlPayResponse {
  callback: string;
  allowsNostr: boolean;
  nostrPubkey: string;
  minSendable: number;
  maxSendable: number;
}

function bech32Encode(hrp: string, data: number[]) {
  const lowerHrp = hrp.toLowerCase();
  const checksum = bech32CreateChecksum(lowerHrp, data);
  return `${lowerHrp}1${[...data, ...checksum].map((value) => bech32Charset[value]).join('')}`;
}

function bech32Decode(value: string) {
  if (value !== value.toLowerCase() && value !== value.toUpperCase()) return null;
  const normalized = value.toLowerCase();
  const separatorIndex = normalized.lastIndexOf('1');
  if (separatorIndex <= 0 || separatorIndex + 7 > normalized.length) return null;
  const hrp = normalized.slice(0, separatorIndex);
  const data = [...normalized.slice(separatorIndex + 1)].map((char) => bech32Charset.indexOf(char));
  if (data.some((item) => item < 0) || bech32Polymod([...bech32HrpExpand(hrp), ...data]) !== 1) return null;
  return { hrp, data: data.slice(0, -6) };
}

function bech32CreateChecksum(hrp: string, data: number[]) {
  const values = [...bech32HrpExpand(hrp), ...data, 0, 0, 0, 0, 0, 0];
  const polymod = bech32Polymod(values) ^ 1;
  return [0, 1, 2, 3, 4, 5].map((index) => (polymod >> (5 * (5 - index))) & 31);
}

function bech32HrpExpand(hrp: string) {
  return [...hrp].map((char) => char.charCodeAt(0) >> 5).concat(0, [...hrp].map((char) => char.charCodeAt(0) & 31));
}

function bech32Polymod(values: number[]) {
  let chk = 1;
  for (const value of values) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ value;
    for (let i = 0; i < 5; i += 1) {
      if ((top >> i) & 1) chk ^= bech32Generator[i];
    }
  }
  return chk;
}

function convertBits(data: number[], fromBits: number, toBits: number, pad: boolean) {
  let acc = 0;
  let bits = 0;
  const maxv = (1 << toBits) - 1;
  const result: number[] = [];

  for (const value of data) {
    if (value < 0 || value >> fromBits) throw new Error('Invalid bech32 data.');
    acc = (acc << fromBits) | value;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      result.push((acc >> bits) & maxv);
    }
  }

  if (pad) {
    if (bits > 0) result.push((acc << (toBits - bits)) & maxv);
  } else if (bits >= fromBits || ((acc << (toBits - bits)) & maxv)) {
    throw new Error('Invalid bech32 padding.');
  }

  return result;
}
