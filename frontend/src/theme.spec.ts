// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chartThemePalette } from './chart-theme';

function luminance(hex: string) {
  const channels = hex
    .replace('#', '')
    .match(/../g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(first: string, second: string) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function cssVariable(block: string, name: string) {
  return block.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1] ?? '';
}

function setSystemTheme(dark: boolean) {
  let currentDark = dark;
  const listeners: Array<() => void> = [];
  const mediaQuery = {
    get matches() {
      return currentDark;
    },
    addEventListener: vi.fn((_event: string, listener: () => void) => {
      listeners.push(listener);
    }),
  };
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue(mediaQuery),
  });
  return (nextDark: boolean) => {
    currentDark = nextDark;
    listeners.forEach((listener) => listener());
  };
}

describe('preferencia de tema', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('respeta el modo oscuro del sistema cuando no existe una preferencia', async () => {
    setSystemTheme(true);
    const { resolvedTheme, themePreference } = await import('./theme');

    expect(themePreference.value).toBe('system');
    expect(resolvedTheme.value).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('aplica el tema inmediatamente y lo persiste en localStorage', async () => {
    setSystemTheme(false);
    const { applyTheme, resolvedTheme } = await import('./theme');

    applyTheme('dark');

    expect(resolvedTheme.value).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('teachtrace_theme')).toBe('dark');
  });

  it('actualiza el tema cuando cambia el sistema y la preferencia sigue en system', async () => {
    const changeSystemTheme = setSystemTheme(true);
    const { resolvedTheme, themePreference } = await import('./theme');

    changeSystemTheme(false);

    expect(themePreference.value).toBe('system');
    expect(resolvedTheme.value).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('mantiene contraste WCAG AA en los textos principales de ambos modos', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    const light = css.match(/:root\s*\{([^}]+)\}/)?.[1] ?? '';
    const dark = css.match(/html\.dark\s*\{([^}]+)\}/)?.[1] ?? '';

    expect(contrastRatio(cssVariable(light, 'ink'), cssVariable(light, 'canvas'))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(cssVariable(light, 'muted'), cssVariable(light, 'paper'))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#ffffff', cssVariable(light, 'primary-solid'))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(cssVariable(dark, 'ink'), cssVariable(dark, 'canvas'))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(cssVariable(dark, 'muted'), cssVariable(dark, 'paper'))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#ffffff', cssVariable(dark, 'primary-solid'))).toBeGreaterThanOrEqual(4.5);

    for (const palette of [
      chartThemePalette('light', false),
      chartThemePalette('dark', false),
      chartThemePalette('dark', true),
    ]) {
      expect(contrastRatio(palette.text, palette.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(palette.primary, palette.surface)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(palette.secondary, palette.surface)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(palette.accent, palette.surface)).toBeGreaterThanOrEqual(3);
    }

    expect(css).toMatch(
      /\.notification-checkbox input:checked \+ span[^{}]*\{[^}]*background:\s*var\(--primary-solid\)/,
    );
    expect(css).toMatch(
      /\.logbook-step-button\.active \.logbook-step-number[^{}]*\{[^}]*background:\s*var\(--primary-solid\)/,
    );
  });
});
