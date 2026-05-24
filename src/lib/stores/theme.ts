import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export type ThemeMode = 'light' | 'dark';

const storageKey = 'nostr-theme';
const initialTheme = browser ? readThemeMode() : 'light';

export const themeMode = writable<ThemeMode>(initialTheme);

export function setThemeMode(mode: ThemeMode) {
  if (isNativeShell()) {
    themeMode.set('dark');
    return;
  }
  themeMode.set(mode);
}

export function cycleThemeMode(mode: ThemeMode) {
  return mode === 'light' ? 'dark' : 'light';
}

themeMode.subscribe((mode) => {
  if (!browser) return;
  document.documentElement.dataset.theme = mode;
  localStorage.setItem(storageKey, mode);
});

function readThemeMode(): ThemeMode {
  if (isNativeShell()) return 'dark';
  const saved = localStorage.getItem(storageKey);
  if (saved === 'dark') return 'dark';
  if (saved !== 'light') localStorage.setItem(storageKey, 'light');
  return 'light';
}

function isNativeShell() {
  return Boolean(browser && window.Capacitor?.isNativePlatform?.());
}
