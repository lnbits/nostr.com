import { browser } from '$app/environment';
import type { Session } from '$lib/nostr/types';

const nativePrivateKeySessionKey = 'nostr-native-private-key-session';

export async function canUseNativeSecureSessionStorage() {
  if (!browser) return false;
  try {
    const { Capacitor } = await import('@capacitor/core');
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
}

export async function readNativePrivateKeySession(): Promise<Session | null> {
  if (!(await canUseNativeSecureSessionStorage())) return null;
  try {
    const { SecureStoragePlugin } = await import('capacitor-secure-storage-plugin');
    const { value } = await SecureStoragePlugin.get({ key: nativePrivateKeySessionKey });
    const saved = JSON.parse(value) as Session;
    if (saved.mode !== 'private-key' || !isHexKey(saved.pubkey) || !isHexKey(saved.secret)) {
      await clearNativePrivateKeySession();
      return null;
    }
    return { pubkey: saved.pubkey, mode: 'private-key', secret: saved.secret };
  } catch {
    return null;
  }
}

export async function persistNativePrivateKeySession(session: Session) {
  if (!(await canUseNativeSecureSessionStorage())) return;
  if (session.mode !== 'private-key' || !isHexKey(session.pubkey) || !isHexKey(session.secret)) return;
  const { SecureStoragePlugin } = await import('capacitor-secure-storage-plugin');
  await SecureStoragePlugin.set({
    key: nativePrivateKeySessionKey,
    value: JSON.stringify({ pubkey: session.pubkey, mode: session.mode, secret: session.secret } satisfies Session)
  });
}

export async function clearNativePrivateKeySession() {
  if (!(await canUseNativeSecureSessionStorage())) return;
  try {
    const { SecureStoragePlugin } = await import('capacitor-secure-storage-plugin');
    await SecureStoragePlugin.remove({ key: nativePrivateKeySessionKey });
  } catch {
    // Missing keys throw; logout should still succeed.
  }
}

function isHexKey(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
}
