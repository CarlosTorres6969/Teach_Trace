// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.vue';
import { auth, clearSession, setSession } from './auth';

const { apiMock, pushMock } = vi.hoisted(() => ({
  apiMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock('./api', () => ({ api: apiMock }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: pushMock }) }));

describe('App - selector de tema', () => {
  beforeEach(() => {
    apiMock.mockReset();
    pushMock.mockReset();
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    apiMock.mockResolvedValue({ theme: 'dark' });
    setSession(
      {
        id: 1,
        email: 'estudiante@unah.edu.hn',
        name: 'Estudiante',
        role: 'student',
        theme: 'light',
        accessibilitySettings: {
          fontSize: 100,
          highContrast: false,
          reducedMotion: false,
        },
      },
      false,
    );
  });

  afterEach(() => {
    clearSession(false);
    document.documentElement.classList.remove('dark');
  });

  it('cambia a oscuro inmediatamente y persiste la selección en la API', async () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
          RouterView: { template: '<div />' },
        },
      },
    });

    await wrapper.get('.theme-toggle').trigger('click');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('teachtrace_theme')).toBe('dark');
    await flushPromises();

    expect(apiMock).toHaveBeenCalledWith('/users/me/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ theme: 'dark' }),
    });
    expect(auth.user?.theme).toBe('dark');
    expect(wrapper.get('.theme-toggle').attributes('aria-label')).toBe('Activar modo claro');
  });

  it('revierte el cambio local si no puede persistir la preferencia', async () => {
    let rejectPreference!: (reason: Error) => void;
    apiMock.mockImplementation((path: string) => {
      if (path === '/users/me/preferences') {
        return new Promise((_resolve, reject) => {
          rejectPreference = reject;
        });
      }
      return Promise.resolve({ count: 0 });
    });
    const wrapper = mount(App, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
          RouterView: { template: '<div />' },
        },
      },
    });
    await flushPromises();

    await wrapper.get('.theme-toggle').trigger('click');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    rejectPreference(new Error('No se pudo guardar'));
    await flushPromises();

    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('teachtrace_theme')).toBe('light');
    expect(auth.user?.theme).toBe('light');
    expect(wrapper.get('.theme-toggle').attributes('aria-label')).toBe('Activar modo oscuro');
  });
});
