// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function luminance(hex: string) {
  const values = hex
    .replace('#', '')
    .match(/.{2}/g)!
    .map((value) => Number.parseInt(value, 16) / 255)
    .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
}

function contrastRatio(first: string, second: string) {
  const lighter = Math.max(luminance(first), luminance(second));
  const darker = Math.min(luminance(first), luminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

function cssVariable(block: string, name: string) {
  return block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1] ?? '';
}

function mockReducedMotion(matches: boolean) {
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })));
}

describe('configuracion de accesibilidad', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    document.documentElement.classList.remove('high-contrast', 'reduced-motion');
    document.documentElement.style.removeProperty('--app-font-size');
    mockReducedMotion(false);
  });

  it('aplica y persiste el tamano, alto contraste y movimiento reducido', async () => {
    const { applyAccessibilitySettings } = await import('./accessibility');

    applyAccessibilitySettings({ fontSize: 135, highContrast: true, reducedMotion: true });

    expect(document.documentElement.style.getPropertyValue('--app-font-size')).toBe('135%');
    expect(document.documentElement.classList.contains('high-contrast')).toBe(true);
    expect(document.documentElement.classList.contains('reduced-motion')).toBe(true);
    expect(JSON.parse(localStorage.getItem('teachtrace_accessibility') ?? '{}')).toEqual({
      fontSize: 135,
      highContrast: true,
      reducedMotion: true,
    });
  });

  it('respeta prefers-reduced-motion aunque la preferencia guardada este desactivada', async () => {
    mockReducedMotion(true);
    const { applyAccessibilitySettings } = await import('./accessibility');

    applyAccessibilitySettings({ fontSize: 100, highContrast: false, reducedMotion: false });

    expect(document.documentElement.classList.contains('reduced-motion')).toBe(true);
  });

  it('mantiene contraste AAA en los colores principales de la paleta alternativa', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    const highContrast = css.match(/html\.high-contrast\s*\{([^}]+)\}/)?.[1] ?? '';
    const paper = cssVariable(highContrast, 'paper');

    expect(contrastRatio(cssVariable(highContrast, 'ink'), paper)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(cssVariable(highContrast, 'muted'), paper)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(cssVariable(highContrast, 'green'), paper)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio('#ffffff', cssVariable(highContrast, 'primary-solid'))).toBeGreaterThanOrEqual(7);
  });
});
