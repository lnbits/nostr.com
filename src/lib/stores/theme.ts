import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export type ThemeMode = 'light' | 'dark';

const storageKey = 'nostr-theme';
const initialTheme = browser ? readThemeMode() : 'dark';

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
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', mode === 'dark' ? '#000000' : '#fffdf8');
  localStorage.setItem(storageKey, mode);
});

function readThemeMode(): ThemeMode {
  const saved = localStorage.getItem(storageKey);
  if (saved === 'light') return 'light';
  if (saved === 'dark') return 'dark';
  localStorage.setItem(storageKey, 'dark');
  return 'dark';
}
