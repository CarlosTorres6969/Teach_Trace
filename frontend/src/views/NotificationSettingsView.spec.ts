// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NotificationSettingsView from './NotificationSettingsView.vue';

const { apiMock } = vi.hoisted(() => ({ apiMock: vi.fn() }));

vi.mock('../api', () => ({ api: apiMock }));

const defaultPreferences = [
  'NEW_ACTIVITY',
  'GRADE_PUBLISHED',
  'MESSAGE_RECEIVED',
  'ACTIVITY_DUE_SOON',
  'SUBMISSION_STATUS_CHANGED',
].map((eventType) => ({ eventType, channels: ['EMAIL', 'PUSH', 'IN_APP'] }));

describe('NotificationSettingsView', () => {
  beforeEach(() => {
    apiMock.mockReset();
    apiMock.mockImplementation((_path: string, options?: RequestInit) => {
      if (options?.method === 'PUT') {
        return Promise.resolve(JSON.parse(String(options.body)).preferences);
      }
      return Promise.resolve(structuredClone(defaultPreferences));
    });
  });

  it('muestra todos los eventos y mantiene activo el canal en plataforma', async () => {
    const wrapper = mount(NotificationSettingsView, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    });
    await flushPromises();

    expect(wrapper.findAll('tbody tr')).toHaveLength(5);
    expect(wrapper.text()).toContain('Nueva actividad');
    expect(wrapper.text()).toContain('Calificación publicada');
    expect(wrapper.text()).toContain('Mensaje docente');

    const inAppCheckboxes = wrapper.findAll('input[aria-label$="En plataforma"]');
    expect(inAppCheckboxes).toHaveLength(5);
    for (const checkbox of inAppCheckboxes) {
      expect((checkbox.element as HTMLInputElement).checked).toBe(true);
      expect(checkbox.attributes('disabled')).toBeDefined();
    }
  });

  it('guarda los cambios y muestra una confirmación', async () => {
    const wrapper = mount(NotificationSettingsView, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    });
    await flushPromises();

    await wrapper.get('input[aria-label="Nueva actividad: Email"]').setValue(false);
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    const updateCall = apiMock.mock.calls.find(([, options]) => options?.method === 'PUT');
    expect(updateCall?.[0]).toBe('/notification-preferences');
    const body = JSON.parse(String(updateCall?.[1]?.body));
    expect(body.preferences[0]).toEqual({
      eventType: 'NEW_ACTIVITY',
      channels: ['PUSH', 'IN_APP'],
    });
    expect(wrapper.get('[role="status"]').text()).toContain('Preferencias guardadas');
  });
});
