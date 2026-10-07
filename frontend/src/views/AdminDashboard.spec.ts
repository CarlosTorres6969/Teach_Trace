// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import AdminDashboard from './AdminDashboard.vue';

vi.mock('../api', () => ({ api: vi.fn() }));
vi.mock('../auth', () => ({
  auth: { user: { id: 1, name: 'Administrador', role: 'admin' } },
}));

const apiMock = vi.mocked(api);

describe('AdminDashboard', () => {
  beforeEach(() => {
    apiMock.mockReset();
    apiMock.mockImplementation(async (path, options = {}) => {
      if (path === '/admin/ai-engine') {
        return { model: 'default', instructions: 'Evalúa con evidencia.', stageInstructions: { aiUsage: 'Uso', suggestedGrade: 'Nota', feedback: 'Comentarios', understanding: 'Comprensión', indicators: 'Indicadores' }, effectiveModel: 'server-model', enabled: true, providerConfigured: true } as never;
      }
      if (path === '/admin/teachers' && !options.method) {
        return [{
          id: 4,
          name: 'Docente existente',
          email: 'docente@unah.edu.hn',
          active: true,
          mustChangePassword: false,
        }] as never;
      }
      if (path === '/admin/teachers' && options.method === 'POST') {
        return {
          id: 5,
          name: 'Nueva Docente',
          email: 'nueva.docente@unah.edu.hn',
          active: true,
          mustChangePassword: true,
          invitationEmailSent: true,
        } as never;
      }
      throw new Error(`Solicitud inesperada: ${path}`);
    });
  });

  afterEach(() => {
    document.body.classList.remove('modal-open');
  });

  it('lista los docentes y crea una cuenta con invitación temporal', async () => {
    const wrapper = mount(AdminDashboard);
    await flushPromises();

    expect(wrapper.text()).toContain('Docente existente');
    await wrapper.get('.page-heading .button').trigger('click');
    await wrapper.get('.modal-body input[type="text"]').setValue('Nueva Docente');
    await wrapper.get('.modal-body input[type="email"]').setValue('nueva.docente@unah.edu.hn');
    await wrapper.get('.modal-body').trigger('submit');
    await flushPromises();

    expect(apiMock).toHaveBeenCalledWith('/admin/teachers', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Nueva Docente',
        email: 'nueva.docente@unah.edu.hn',
      }),
    });
    expect(wrapper.text()).toContain('Nueva Docente');
    expect(wrapper.text()).toContain('contraseña temporal fue enviada por correo');
    expect(wrapper.find('.modal-dialog').exists()).toBe(false);
  });
});
