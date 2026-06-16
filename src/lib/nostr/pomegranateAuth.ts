import { browser } from '$app/environment';
import { finalizeEvent, generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';
import { bytesToHex } from '@noble/hashes/utils.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { hexPubShard, hexShard, trustedKeyDeal } from '@fiatjaf/promenade-trusted-dealer';
import { defaultPomegranateCentral, defaultPomegranateGoogleClientId, defaultPomegranateOperators } from './config';
import { loginWithBunker, normalizePomegranateCentralUrl, pomegranateBunkerUrl } from './client';
import type { Session } from './types';

const authStorageKey = 'nostr-pomegranate-auth';
const tokenMaxAgeMs = 24 * 60 * 60 * 1000;
const utf8 = new TextEncoder();

export type PomegranateLoginProvider = 'email' | 'google';

export interface PomegranateProfile {
  handler_pubkey: string;
  name: string;
  email?: string;
  filter?: Record<string, unknown>;
  created_at?: number;
  last_used_at?: number;
}

type PomegranateAccount = {
  pubkey: string;
  email?: string;
};

type StoredPomegranateAuth = {
  token: string;
  centralUrl: string;
  createdAt: number;
  email?: string;
};

class PomegranateRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export function validateImportedNsec(value: string) {
  const secretKey = decodeNsec(value);
  const pubkey = getPublicKey(secretKey);
  secretKey.fill(0);
  return { pubkey, npub: nip19.npubEncode(pubkey) };
}

export function clearPomegranateAuth() {
  if (!browser) return;
  sessionStorage.removeItem(authStorageKey);
}

export async function loginWithPomegranateProvider(provider: PomegranateLoginProvider = 'google') {
  const auth = await authenticatePomegranate(provider);
  let account = await fetchPomegranateAccountIfExists(auth.centralUrl, auth.token);
  if (!account) {
    const secretKey = generateSecretKey();
    try {
      account = await createPomegranateAccount(auth, secretKey);
    } finally {
      secretKey.fill(0);
    }
  }
  return finishPomegranateLogin(auth, account);
}

export async function importNsecIntoPomegranate(value: string, provider: PomegranateLoginProvider = 'google', options: { replaceExisting?: boolean } = {}) {
  const secretKey = decodeNsec(value);
  try {
    const auth = await authenticatePomegranate(provider);
    const importedPubkey = getPublicKey(secretKey);
    let existing = await fetchPomegranateAccountIfExists(auth.centralUrl, auth.token);
    if (existing && existing.pubkey !== importedPubkey) {
      if (!options.replaceExisting) throw new Error('This Pomegranate login is already connected to a different npub. Enable replace identity to import this key for the same login.');
      await deletePomegranateAccount(auth.centralUrl, auth.token);
      existing = null;
    }
    const account = existing ?? (await createPomegranateAccount(auth, secretKey));
    return finishPomegranateLogin(auth, account);
  } finally {
    secretKey.fill(0);
  }
}

export async function listPomegranateConnections() {
  const auth = await requirePomegranateAuth();
  const profiles = await pomegranateFetch<PomegranateProfile[]>(auth.centralUrl, '/profiles', auth.token);
  return profiles.map((profile) => withBunkerUrl(auth.centralUrl, profile));
}

export async function createPomegranateConnection(name = 'Connect another Nostr app') {
  const auth = await requirePomegranateAuth();
  const profile = await pomegranateFetch<PomegranateProfile>(auth.centralUrl, '/profiles', auth.token, {
    method: 'POST',
    body: JSON.stringify({ name })
  });
  return withBunkerUrl(auth.centralUrl, profile);
}

export async function findOrCreatePomegranateConnection(name: string) {
  const clean = name.trim();
  if (!clean) throw new Error('Enter a connection name.');
  const existing = (await listPomegranateConnections()).find((profile) => profile.name === clean);
  return existing ?? createPomegranateConnection(clean);
}

export async function renamePomegranateConnection(handlerPubkey: string, name: string) {
  const auth = await requirePomegranateAuth();
  const clean = name.trim();
  if (!clean) throw new Error('Enter a connection name.');
  const profile = await pomegranateFetch<PomegranateProfile>(auth.centralUrl, `/profiles/${handlerPubkey}`, auth.token, {
    method: 'PATCH',
    body: JSON.stringify({ name: clean })
  });
  return withBunkerUrl(auth.centralUrl, profile);
}

export async function revokePomegranateConnection(handlerPubkey: string) {
  const auth = await requirePomegranateAuth();
  await pomegranateFetch<void>(auth.centralUrl, `/profiles/${handlerPubkey}`, auth.token, { method: 'DELETE', expectJson: false });
}

export async function rotatePomegranateConnection(profile: PomegranateProfile) {
  const auth = await requirePomegranateAuth();
  await pomegranateFetch<void>(auth.centralUrl, `/profiles/${profile.handler_pubkey}`, auth.token, { method: 'DELETE', expectJson: false });
  const replacement = await pomegranateFetch<PomegranateProfile>(auth.centralUrl, '/profiles', auth.token, {
    method: 'POST',
    body: JSON.stringify({ name: profile.name || 'Connected app', filter: profile.filter })
  });
  return withBunkerUrl(auth.centralUrl, replacement);
}

export function currentPomegranateAuth() {
  return readStoredPomegranateAuth();
}

export function pomegranateConnectionUri(centralUrl: string, profile: PomegranateProfile) {
  return pomegranateBunkerUrl(centralUrl, profile.handler_pubkey);
}

async function finishPomegranateLogin(auth: StoredPomegranateAuth, account: PomegranateAccount): Promise<Session> {
  const profile = await ensurePomegranateDefaultProfile(auth.centralUrl, auth.token);
  const session = await loginWithBunker(pomegranateConnectionUri(auth.centralUrl, profile));
  if (account.pubkey && account.pubkey !== session.pubkey) throw new Error('Pomegranate account key did not match the remote signer.');
  return {
    ...session,
    mode: 'pomegranate',
    pomegranateCentral: auth.centralUrl,
    pomegranateEmail: auth.email || account.email || profile.email,
    pomegranateProfile: profile.name
  };
}

async function authenticatePomegranate(provider: PomegranateLoginProvider) {
  const centralUrl = normalizePomegranateCentralUrl(defaultPomegranateCentral);
  const token = await authenticatePomegranateCentral(centralUrl, provider);
  const auth: StoredPomegranateAuth = {
    token,
    centralUrl,
    createdAt: tokenCreatedAt(token) || Date.now(),
    email: pomegranateEmailFromToken(token)
  };
  storePomegranateAuth(auth);
  return auth;
}

async function authenticatePomegranateCentral(centralUrl: string, provider: PomegranateLoginProvider) {
  if (typeof window === 'undefined') throw new Error('Pomegranate login is only available in the browser.');
  if (provider === 'google' && (await isAndroidNativeApp())) return authenticatePomegranateCentralAndroid(centralUrl);
  return new Promise<string>((resolve, reject) => {
    const loginUrl = new URL(`${centralUrl}/login/${provider}`);
    if (provider === 'google') loginUrl.searchParams.set('prompt', 'select_account');
    const popup = window.open(loginUrl.toString(), 'pomegranate-login', 'width=560,height=720');
    if (!popup) {
      reject(new Error('Pomegranate login popup was blocked.'));
      return;
    }
    let settled = false;
    const cleanup = () => {
      settled = true;
      clearTimeout(timeout);
      clearInterval(closedCheck);
      window.removeEventListener('message', onMessage);
    };
    const finish = (token: string) => {
      cleanup();
      popup.close();
      resolve(token);
    };
    const fail = () => {
      cleanup();
      reject(new Error(`Could not sign in with ${provider}. Please try again.`));
    };
    const timeout = setTimeout(fail, 120_000);
    const closedCheck = setInterval(() => {
      if (!settled && popup.closed) fail();
    }, 500);
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== centralUrl) return;
      const token = typeof event.data?.token === 'string' ? event.data.token : '';
      if (token) finish(token);
    };
    window.addEventListener('message', onMessage);
  });
}

async function authenticatePomegranateCentralAndroid(centralUrl: string) {
  if (centralUrl !== normalizePomegranateCentralUrl(defaultPomegranateCentral)) {
    throw new Error('Android Google login is only configured for the default Pomegranate coordinator.');
  }
  const { GoogleAuth } = await import('@southdevs/capacitor-google-auth');
  await GoogleAuth.initialize({
    clientId: defaultPomegranateGoogleClientId,
    scopes: ['profile', 'email'],
    grantOfflineAccess: false
  });
  const user = await GoogleAuth.signIn({
    clientId: defaultPomegranateGoogleClientId,
    scopes: ['profile', 'email'],
    grantOfflineAccess: false
  });
  const idToken = user.authentication?.idToken ?? '';
  if (!idToken) throw new Error('Google did not return an Android ID token.');
  const response = await fetch(`${centralUrl}/login/google/android`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_token: idToken })
  });
  if (!response.ok) throw new PomegranateRequestError(response.status, pomegranateRequestMessage(response.status));
  const payload = (await response.json()) as { token?: string };
  if (!payload.token) throw new Error('Pomegranate did not return an auth token.');
  return payload.token;
}

async function isAndroidNativeApp() {
  try {
    const { Capacitor } = await import('@capacitor/core');
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
}

async function createPomegranateAccount(auth: StoredPomegranateAuth, secretKey: Uint8Array) {
  const email = auth.email || pomegranateEmailFromToken(auth.token);
  if (!email) throw new Error('Pomegranate did not return a verified email address.');
  const operators = defaultPomegranateOperators.map(normalizeWebUrl);
  if (operators.length < 2) throw new Error('Pomegranate operators are unavailable.');
  const threshold = Math.ceil((operators.length * 7) / 12);
  const registrationSession = crypto.randomUUID();
  const secretKeyBignum = Array.from(secretKey).reduce((acc, byte) => (acc << 8n) + BigInt(byte), 0n);
  const { shards } = trustedKeyDeal(secretKeyBignum, threshold, operators.length);

  const registrationEvent = finalizeEvent(
    {
      kind: 20445,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['threshold', String(threshold)], ...operators.map((operator, index) => ['operator', operator, hexPubShard(shards[index].pubShard)])],
      content: ''
    },
    secretKey
  );

  await pomegranateFetch<void>(auth.centralUrl, '/register', auth.token, {
    method: 'POST',
    body: JSON.stringify(registrationEvent),
    headers: { 'X-Pomegranate-Session': registrationSession },
    expectJson: false
  });

  for (let index = 0; index < operators.length; index += 1) {
    const operator = operators[index];
    const shard = shards[index];
    const event = finalizeEvent(
      {
        kind: 20444,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['central', auth.centralUrl],
          ['email', email]
        ],
        content: hexShard(shard)
      },
      secretKey
    );
    const response = await fetch(`${operator}/po/register`, {
      method: 'POST',
      body: JSON.stringify(event),
      headers: {
        'Content-Type': 'application/json',
        'X-Pomegranate-Operator-Token': bytesToHex(sha256(utf8.encode(`${registrationSession}:${operator}`)))
      }
    });
    if (!response.ok) throw new Error('A Pomegranate operator was unavailable. Please try again.');
  }

  const account = await waitForPomegranateAccount(auth.centralUrl, auth.token);
  if (!account) throw new Error('Pomegranate account registration did not complete.');
  return account;
}

async function waitForPomegranateAccount(centralUrl: string, token: string) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const account = await fetchPomegranateAccountIfExists(centralUrl, token);
    if (account) return account;
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  return null;
}

async function deletePomegranateAccount(centralUrl: string, token: string) {
  await pomegranateFetch<void>(centralUrl, '/account', token, { method: 'DELETE', expectJson: false });
}

async function fetchPomegranateAccountIfExists(centralUrl: string, token: string) {
  try {
    return await pomegranateFetch<PomegranateAccount>(centralUrl, '/account', token);
  } catch (error) {
    if (error instanceof PomegranateRequestError && error.status === 404) return null;
    throw error;
  }
}

async function ensurePomegranateDefaultProfile(centralUrl: string, token: string) {
  const profiles = await pomegranateFetch<PomegranateProfile[]>(centralUrl, '/profiles', token);
  const existing = profiles.find((profile) => profile.name === 'default') ?? profiles[0];
  if (existing) return existing;
  return pomegranateFetch<PomegranateProfile>(centralUrl, '/profiles', token, {
    method: 'POST',
    body: JSON.stringify({ name: 'default' })
  });
}

async function pomegranateFetch<T>(centralUrl: string, path: string, token: string, init: RequestInit & { expectJson?: boolean } = {}) {
  const response = await fetch(`${centralUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Token ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers
    }
  });
  if (!response.ok) throw new PomegranateRequestError(response.status, pomegranateRequestMessage(response.status));
  if (init.expectJson === false || response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function pomegranateRequestMessage(status: number) {
  if (status === 401) return 'Your Pomegranate login expired. Please sign in again.';
  if (status === 404) return 'Pomegranate could not find this account or connection.';
  if (status >= 500) return 'Pomegranate is unavailable. Please try again.';
  return `Pomegranate request failed (${status}).`;
}

async function requirePomegranateAuth() {
  const auth = readStoredPomegranateAuth();
  if (!auth) throw new Error('Sign in with Pomegranate before managing connected apps.');
  return auth;
}

function storePomegranateAuth(auth: StoredPomegranateAuth) {
  if (!browser) return;
  sessionStorage.setItem(authStorageKey, JSON.stringify(auth));
}

function readStoredPomegranateAuth() {
  if (!browser) return null;
  try {
    const raw = sessionStorage.getItem(authStorageKey);
    if (!raw) return null;
    const auth = JSON.parse(raw) as StoredPomegranateAuth;
    if (!auth.token || !auth.centralUrl || Date.now() - auth.createdAt > tokenMaxAgeMs) {
      sessionStorage.removeItem(authStorageKey);
      return null;
    }
    return auth;
  } catch {
    sessionStorage.removeItem(authStorageKey);
    return null;
  }
}

function tokenCreatedAt(token: string) {
  try {
    const decoded = JSON.parse(atob(token)) as { created_at?: number };
    return decoded.created_at ? decoded.created_at * 1000 : 0;
  } catch {
    return 0;
  }
}

function pomegranateEmailFromToken(token: string) {
  try {
    const decoded = JSON.parse(atob(token)) as { tags?: string[][] };
    return decoded.tags?.find((tag) => tag[0] === 'email' && tag[1])?.[1] ?? '';
  } catch {
    return '';
  }
}

function decodeNsec(value: string) {
  try {
    const decoded = nip19.decode(value.trim());
    if (decoded.type !== 'nsec' || !(decoded.data instanceof Uint8Array)) throw new Error('Enter a valid nsec private key.');
    return new Uint8Array(decoded.data);
  } catch {
    throw new Error('Enter a valid nsec private key.');
  }
}

function normalizeWebUrl(input: string) {
  return normalizePomegranateCentralUrl(input);
}

function withBunkerUrl(centralUrl: string, profile: PomegranateProfile) {
  return {
    ...profile,
    bunker: pomegranateConnectionUri(centralUrl, profile)
  };
}
