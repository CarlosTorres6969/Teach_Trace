// @vitest-environment jsdom

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.vue';
import { auth, clearSession, setSession } from './auth';

const { apiMock, pushMock, registerPushMock, unregisterPushMock } = vi.hoisted(() => ({
  apiMock: vi.fn(),
  pushMock: vi.fn(),
  registerPushMock: vi.fn(),
  unregisterPushMock: vi.fn(),
}));

vi.mock('./api', () => ({ api: apiMock }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: pushMock }) }));
vi.mock('./usePush', () => ({
  registerPushNotifications: registerPushMock,
  unregisterPushNotifications: unregisterPushMock,
}));

class MockEventSource {
  static instances: MockEventSource[] = [];

  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  close = vi.fn();

  constructor(
    public readonly url: string,
    public readonly options?: EventSourceInit,
  ) {
    MockEventSource.instances.push(this);
  }

  emit(data: unknown) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }));
  }

  fail() {
    this.onerror?.(new Event('error'));
  }
}

function studentSession() {
  setSession(
    {
      id: 1,
      email: 'estudiante@unah.edu.hn',
      name: 'Estudiante',
      role: 'student',
      mustChangePassword: false,
      theme: 'light',
      accessibilitySettings: {
        fontSize: 100,
        highContrast: false,
        reducedMotion: false,
      },
    },
    false,
  );
}

function mountApp() {
  return mount(App, {
    global: {
      stubs: {
        RouterLink: { template: '<a><slot /></a>' },
        RouterView: { template: '<div />' },
      },
    },
  });
}

describe('App', () => {
  let wrapper: VueWrapper | null = null;

  beforeEach(() => {
    apiMock.mockReset();
    pushMock.mockReset();
    registerPushMock.mockReset().mockResolvedValue(undefined);
    unregisterPushMock.mockReset().mockResolvedValue(undefined);
    MockEventSource.instances = [];
    vi.stubGlobal('EventSource', MockEventSource);
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    apiMock.mockImplementation((path: string) => {
      if (path === '/notifications/unread-count') return Promise.resolve({ count: 0 });
      if (path === '/notifications') return Promise.resolve([]);
      if (path === '/users/me/preferences') return Promise.resolve({ theme: 'dark' });
      return Promise.resolve({});
    });
    studentSession();
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    clearSession(false);
    document.documentElement.classList.remove('dark');
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('cambia a oscuro inmediatamente y persiste la selección en la API', async () => {
    wrapper = mountApp();

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
    wrapper = mountApp();
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

  it('actualiza inmediatamente el badge mediante un evento SSE autenticable', async () => {
    apiMock.mockImplementation((path: string) => {
      if (path === '/notifications/unread-count') return Promise.resolve({ count: 1 });
      return Promise.resolve([]);
    });

    wrapper = mountApp();
    await flushPromises();

    expect(MockEventSource.instances).toHaveLength(1);
    const source = MockEventSource.instances[0];
    expect(source.url).toContain('/notifications/badge-stream');
    expect(source.options).toEqual({ withCredentials: true });
    expect(registerPushMock).toHaveBeenCalledOnce();
    expect(wrapper.get('.bell-badge').text()).toBe('1');

    source.emit({ count: 4 });
    await flushPromises();

    expect(wrapper.get('.bell-badge').text()).toBe('4');
    expect(wrapper.get('.bell-button').attributes('aria-label')).toContain('4 sin leer');
  });

  it('mantiene el polling cada 30 segundos como respaldo cuando falla SSE', async () => {
    vi.useFakeTimers();
    apiMock.mockImplementation((path: string) => {
      if (path === '/notifications/unread-count') return Promise.resolve({ count: 2 });
      return Promise.resolve([]);
    });

    wrapper = mountApp();
    await flushPromises();
    const source = MockEventSource.instances[0];
    source.fail();

    await vi.advanceTimersByTimeAsync(30000);
    await flushPromises();

    const countRequests = apiMock.mock.calls.filter(
      ([path]) => path === '/notifications/unread-count',
    );
    expect(source.close).toHaveBeenCalledOnce();
    expect(countRequests).toHaveLength(2);
    expect(wrapper.get('.bell-badge').text()).toBe('2');
  });

  it('consulta la campana, marca una notificación y navega a los resultados', async () => {
    const notification = {
      id: 12,
      type: 'GRADE_PUBLISHED',
      title: 'Tu entrega ha sido calificada',
      message: 'Ya puedes consultar el resultado.',
      read: false,
      activityId: 45,
      createdAt: '2026-09-11T12:00:00.000Z',
    };
    apiMock.mockImplementation((path: string) => {
      if (path === '/notifications/unread-count') return Promise.resolve({ count: 1 });
      if (path === '/notifications') return Promise.resolve([notification]);
      if (path === '/notifications/12/read') {
        return Promise.resolve({ ...notification, read: true });
      }
      return Promise.resolve({});
    });

    wrapper = mountApp();
    await flushPromises();
    await wrapper.get('.bell-button').trigger('click');
    await flushPromises();

    expect(wrapper.get('.bell-item-content strong').text()).toBe(notification.title);
    await wrapper.get('.bell-item').trigger('click');
    await flushPromises();

    expect(apiMock).toHaveBeenCalledWith('/notifications/12/read', { method: 'PUT' });
    expect(pushMock).toHaveBeenCalledWith('/student/activities/45/results');
    expect(wrapper.find('.bell-badge').exists()).toBe(false);
  });

  it('permite marcar todas las notificaciones como leídas desde la campana', async () => {
    const notification = {
      id: 13,
      type: 'GRADE_PUBLISHED',
      title: 'Calificación publicada',
      message: 'Resultado disponible.',
      read: false,
      activityId: 46,
      createdAt: '2026-09-11T12:00:00.000Z',
    };
    apiMock.mockImplementation((path: string) => {
      if (path === '/notifications/unread-count') return Promise.resolve({ count: 1 });
      if (path === '/notifications') return Promise.resolve([notification]);
      if (path === '/notifications/read-all') return Promise.resolve([]);
      return Promise.resolve({});
    });

    wrapper = mountApp();
    await flushPromises();
    await wrapper.get('.bell-button').trigger('click');
    await flushPromises();
    await wrapper.get('.bell-dropdown-header .text-button').trigger('click');
    await flushPromises();

    expect(apiMock).toHaveBeenCalledWith('/notifications/read-all', { method: 'PUT' });
    expect(wrapper.find('.bell-item').exists()).toBe(false);
    expect(wrapper.find('.bell-badge').exists()).toBe(false);
  });

  it('oculta la navegación y no inicia notificaciones mientras exige cambiar la contraseña', async () => {
    if (!auth.user) throw new Error('Se esperaba una sesión estudiantil');
    auth.user.mustChangePassword = true;

    wrapper = mountApp();
    await flushPromises();

    expect(wrapper.find('.topbar').exists()).toBe(false);
    expect(MockEventSource.instances).toHaveLength(0);
    expect(registerPushMock).not.toHaveBeenCalled();
  });
});
