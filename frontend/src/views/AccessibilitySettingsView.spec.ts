// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AccessibilitySettingsView from './AccessibilitySettingsView.vue';

const { apiMock, user } = vi.hoisted(() => ({
  apiMock: vi.fn(),
  user: {
    id: 1,
    email: 'estudiante@unah.edu.hn',
    name: 'Estudiante',
    role: 'student' as const,
    mustChangePassword: false,
    theme: 'system' as const,
    accessibilitySettings: {
      fontSize: 100,
      highContrast: false,
      reducedMotion: false,
    },
  },
}));

vi.mock('../api', () => ({ api: apiMock }));
vi.mock('../auth', () => ({ auth: { user } }));

describe('AccessibilitySettingsView', () => {
  beforeEach(() => {
    apiMock.mockReset();
    user.accessibilitySettings = {
      fontSize: 100,
      highContrast: false,
      reducedMotion: false,
    };
    localStorage.clear();
    document.documentElement.classList.remove('high-contrast', 'reduced-motion');
    document.documentElement.style.removeProperty('--app-font-size');
  });

  it('muestra una vista previa inmediata y persiste las preferencias', async () => {
    apiMock.mockResolvedValue({
      accessibilitySettings: {
        fontSize: 135,
        highContrast: true,
        reducedMotion: true,
      },
    });
    const wrapper = mount(AccessibilitySettingsView, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    });

    await wrapper.get('#font-size').setValue('135');
    const checkboxes = wrapper.findAll('input[type="checkbox"]');
    await checkboxes[0].setValue(true);
    await checkboxes[1].setValue(true);

    expect(document.documentElement.style.getPropertyValue('--app-font-size')).toBe('135%');
    expect(document.documentElement.classList.contains('high-contrast')).toBe(true);
    expect(document.documentElement.classList.contains('reduced-motion')).toBe(true);

    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(apiMock).toHaveBeenCalledWith('/users/me/preferences', {
      method: 'PATCH',
      body: JSON.stringify({
        accessibilitySettings: {
          fontSize: 135,
          highContrast: true,
          reducedMotion: true,
        },
      }),
    });
    expect(wrapper.text()).toContain('Configuración de accesibilidad guardada.');
    expect(user.accessibilitySettings.fontSize).toBe(135);
  });
});
