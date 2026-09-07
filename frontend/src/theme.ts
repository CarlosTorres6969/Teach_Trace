import { ref } from 'vue';
import type { ThemePreference } from './types';

const THEME_STORAGE_KEY = 'teachtrace_theme';
const DARK_MODE_QUERY = '(prefers-color-scheme: dark)';

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

function storedTheme(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(value) ? value : 'system';
  } catch {
    return 'system';
  }
}

function systemUsesDarkMode() {
  return typeof window !== 'undefined' && window.matchMedia?.(DARK_MODE_QUERY).matches === true;
}

export const themePreference = ref<ThemePreference>(storedTheme());
export const resolvedTheme = ref<'light' | 'dark'>('light');

export function applyTheme(theme: ThemePreference, persist = true) {
  themePreference.value = theme;
  resolvedTheme.value = theme === 'system' ? (systemUsesDarkMode() ? 'dark' : 'light') : theme;
  document.documentElement.classList.toggle('dark', resolvedTheme.value === 'dark');
  document.documentElement.style.colorScheme = resolvedTheme.value;

  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // El tema sigue aplicado aunque el navegador bloquee el almacenamiento local.
    }
  }
}

export function oppositeResolvedTheme(): ThemePreference {
  return resolvedTheme.value === 'dark' ? 'light' : 'dark';
}

applyTheme(themePreference.value, false);

if (typeof window !== 'undefined') {
  const colorScheme = window.matchMedia?.(DARK_MODE_QUERY);
  colorScheme?.addEventListener?.('change', () => {
    if (themePreference.value === 'system') applyTheme('system', false);
  });

  window.addEventListener('storage', (event) => {
    if (event.key === THEME_STORAGE_KEY && isThemePreference(event.newValue)) {
      applyTheme(event.newValue, false);
    }
  });
}
