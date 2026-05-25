import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export type ThemeMode = 'light' | 'dark';

const storageKey = 'nostr-theme';
const initialTheme = browser ? readThemeMode() : 'light';

export const themeMode = writable<ThemeMode>(initialTheme);

export function setThemeMode(mode: ThemeMode) {
  themeMode.set(mode);
}

export function cycleThemeMode(mode: ThemeMode) {
  return mode === 'light' ? 'dark' : 'light';
}

themeMode.subscribe((mode) => {
  if (!browser) return;
  document.documentElement.dataset.theme = mode;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', mode === 'dark' ? '#0f172a' : '#fffdf8');
  localStorage.setItem(storageKey, mode);
});

function readThemeMode(): ThemeMode {
  const saved = localStorage.getItem(storageKey);
  if (saved === 'dark') return 'dark';
  if (saved !== 'light') localStorage.setItem(storageKey, 'light');
  return 'light';
}
