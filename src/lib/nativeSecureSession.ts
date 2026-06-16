import { browser } from '$app/environment';
import type { Session } from '$lib/nostr/types';

const nativePrivateKeySessionKey = 'nostr-native-private-key-session';

export async function canUseNativeSecureSessionStorage() {
  return (await canUseAndroidSecureSessionStorage()) || (await canUseDesktopSecureSessionStorage());
}

export async function readNativePrivateKeySession(): Promise<Session | null> {
  const desktop = await readDesktopPrivateKeySession();
  if (desktop) return desktop;
  if (!(await canUseAndroidSecureSessionStorage())) return null;
  try {
    const { SecureStoragePlugin } = await import('capacitor-secure-storage-plugin');
    const { value } = await SecureStoragePlugin.get({ key: nativePrivateKeySessionKey });
    const saved = privateKeySessionFromJson(value);
    if (!saved) {
      await clearNativePrivateKeySession();
      return null;
    }
    return saved;
  } catch {
    return null;
  }
}

export async function persistNativePrivateKeySession(session: Session) {
  if (session.mode !== 'private-key' || !isHexKey(session.pubkey) || !isHexKey(session.secret)) return;
  if (await persistDesktopPrivateKeySession(session)) return;
  if (!(await canUseAndroidSecureSessionStorage())) return;
  const { SecureStoragePlugin } = await import('capacitor-secure-storage-plugin');
  await SecureStoragePlugin.set({
    key: nativePrivateKeySessionKey,
    value: JSON.stringify({ pubkey: session.pubkey, mode: session.mode, secret: session.secret } satisfies Session)
  });
}

export async function clearNativePrivateKeySession() {
  await clearDesktopPrivateKeySession();
  if (!(await canUseAndroidSecureSessionStorage())) return;
  try {
    const { SecureStoragePlugin } = await import('capacitor-secure-storage-plugin');
    await SecureStoragePlugin.remove({ key: nativePrivateKeySessionKey });
  } catch {
    // Missing keys throw; logout should still succeed.
  }
}

async function canUseAndroidSecureSessionStorage() {
  if (!browser) return false;
  try {
    const { Capacitor } = await import('@capacitor/core');
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
}

async function canUseDesktopSecureSessionStorage() {
  if (!browser) return false;
  try {
    return Boolean(await window.nostrDesktopSecureStorage?.isAvailable());
  } catch {
    return false;
  }
}

async function readDesktopPrivateKeySession() {
  if (!(await canUseDesktopSecureSessionStorage())) return null;
  try {
    const raw = await window.nostrDesktopSecureStorage?.read();
    if (!raw) return null;
    const saved = privateKeySessionFromJson(raw);
    if (!saved) await clearDesktopPrivateKeySession();
    return saved;
  } catch {
    return null;
  }
}

async function persistDesktopPrivateKeySession(session: Session) {
  if (!(await canUseDesktopSecureSessionStorage())) return false;
  try {
    return Boolean(
      await window.nostrDesktopSecureStorage?.write(JSON.stringify({ pubkey: session.pubkey, mode: session.mode, secret: session.secret } satisfies Session))
    );
  } catch {
    return false;
  }
}

async function clearDesktopPrivateKeySession() {
  if (!(await canUseDesktopSecureSessionStorage())) return;
  try {
    await window.nostrDesktopSecureStorage?.clear();
  } catch {
    // Logout should still succeed if desktop secure storage is unavailable.
  }
}

function privateKeySessionFromJson(value: string) {
  try {
    const saved = JSON.parse(value) as Session;
    if (saved.mode !== 'private-key' || !isHexKey(saved.pubkey) || !isHexKey(saved.secret)) return null;
    return { pubkey: saved.pubkey, mode: 'private-key', secret: saved.secret } satisfies Session;
  } catch {
    return null;
  }
}

function isHexKey(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
}
