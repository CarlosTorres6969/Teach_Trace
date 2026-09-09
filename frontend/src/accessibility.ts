import { ref } from 'vue';
import type { AccessibilitySettings } from './types';

const ACCESSIBILITY_STORAGE_KEY = 'teachtrace_accessibility';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export const DEFAULT_ACCESSIBILITY_SETTINGS: AccessibilitySettings = {
  fontSize: 100,
  highContrast: false,
  reducedMotion: false,
};

function isAccessibilitySettings(value: unknown): value is AccessibilitySettings {
  if (!value || typeof value !== 'object') return false;
  const settings = value as Partial<AccessibilitySettings>;
  return (
    Number.isInteger(settings.fontSize) &&
    (settings.fontSize as number) >= 100 &&
    (settings.fontSize as number) <= 150 &&
    typeof settings.highContrast === 'boolean' &&
    typeof settings.reducedMotion === 'boolean'
  );
}

function storedAccessibilitySettings(): AccessibilitySettings {
  try {
    const stored = localStorage.getItem(ACCESSIBILITY_STORAGE_KEY);
    if (!stored) return { ...DEFAULT_ACCESSIBILITY_SETTINGS };
    const parsed: unknown = JSON.parse(stored);
    return isAccessibilitySettings(parsed)
      ? { ...parsed }
      : { ...DEFAULT_ACCESSIBILITY_SETTINGS };
  } catch {
    return { ...DEFAULT_ACCESSIBILITY_SETTINGS };
  }
}

const reducedMotionMedia =
  typeof window !== 'undefined' ? window.matchMedia?.(REDUCED_MOTION_QUERY) : undefined;

export const accessibilitySettings = ref<AccessibilitySettings>(storedAccessibilitySettings());
export const systemPrefersReducedMotion = ref(reducedMotionMedia?.matches === true);

function updateReducedMotionClass() {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle(
    'reduced-motion',
    accessibilitySettings.value.reducedMotion || systemPrefersReducedMotion.value,
  );
}

export function applyAccessibilitySettings(
  settings: AccessibilitySettings,
  persist = true,
) {
  const normalized = isAccessibilitySettings(settings)
    ? { ...settings }
    : { ...DEFAULT_ACCESSIBILITY_SETTINGS };

  accessibilitySettings.value = normalized;

  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--app-font-size', `${normalized.fontSize}%`);
    document.documentElement.classList.toggle('high-contrast', normalized.highContrast);
    updateReducedMotionClass();
  }

  if (persist) {
    try {
      localStorage.setItem(ACCESSIBILITY_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // La configuracion sigue aplicada aunque el almacenamiento local no este disponible.
    }
  }
}

applyAccessibilitySettings(accessibilitySettings.value, false);

reducedMotionMedia?.addEventListener?.('change', (event) => {
  systemPrefersReducedMotion.value = event.matches;
  updateReducedMotionClass();
});

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== ACCESSIBILITY_STORAGE_KEY || !event.newValue) return;
    try {
      const parsed: unknown = JSON.parse(event.newValue);
      if (isAccessibilitySettings(parsed)) applyAccessibilitySettings(parsed, false);
    } catch {
      // Ignorar configuraciones corruptas provenientes de otra pestana.
    }
  });
}
