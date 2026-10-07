// @vitest-environment jsdom

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '../api';
import AdminDashboard from './AdminDashboard.vue';

vi.mock('../api', async (importOriginal) => ({ ...await importOriginal<typeof import('../api')>(), api: vi.fn() }));
vi.mock('../auth', () => ({
  auth: { user: { id: 1, name: 'Administrador', role: 'admin' } },
  clearSession: vi.fn(),
}));

const apiMock = vi.mocked(api);
const wrappers: VueWrapper[] = [];

function mountDashboard() {
  const wrapper = mount(AdminDashboard);
  wrappers.push(wrapper);
  return wrapper;
}

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
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
    document.body.classList.remove('modal-open');
  });

  it('lista los docentes y crea una cuenta con invitación temporal', async () => {
    const wrapper = mountDashboard();
    await flushPromises();

    expect(wrapper.text()).toContain('Docente existente');
    await wrapper.get('.page-heading .button').trigger('click');
    await wrapper.get('.modal-body input[type="text"]').setValue('Nueva Docente');
    await wrapper.get('.modal-body input[type="email"]').setValue('nueva.docente@unah.edu.hn');
    let resolveCreation!: (value: unknown) => void;
    apiMock.mockReturnValueOnce(new Promise((resolve) => { resolveCreation = resolve; }));
    await wrapper.get('.modal-body').trigger('submit');
    expect(wrapper.get('.modal-body').attributes('aria-busy')).toBe('true');
    expect(wrapper.find('.modal-body button[type="submit"] .icon-spin').exists()).toBe(true);
    expect(wrapper.get('.modal-body input[type="text"]').attributes('disabled')).toBeDefined();
    await wrapper.get('.modal-body').trigger('submit');
    expect(apiMock.mock.calls.filter(([path, options]) => path === '/admin/teachers' && options?.method === 'POST')).toHaveLength(1);
    resolveCreation({ id: 5, name: 'Nueva Docente', email: 'nueva.docente@unah.edu.hn', active: true, mustChangePassword: true, invitationEmailSent: true });
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

  it('muestra un error y permite reintentar cuando falla la carga de docentes', async () => {
    apiMock.mockImplementation(async (path) => {
      if (path === '/admin/teachers') throw new Error('Internal database error');
      return { model: 'default', instructions: 'Instrucciones', stageInstructions: { aiUsage: 'Uso', suggestedGrade: 'Nota', feedback: 'Comentarios', understanding: 'Comprensión', indicators: 'Indicadores' }, enabled: true, providerConfigured: true } as never;
    });
    const wrapper = mountDashboard();
    expect(wrapper.find('.empty-state .icon-spin').exists()).toBe(true);
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('No se pudieron cargar los docentes');
    expect(wrapper.text()).not.toContain('Internal database error');
    expect(wrapper.text()).not.toContain('Aún no hay docentes registrados');
    apiMock.mockResolvedValueOnce([{ id: 4, name: 'Docente existente', email: 'docente@unah.edu.hn', active: true, mustChangePassword: false }]);
    await wrapper.get('.empty-state button').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Docente existente');
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it('conserva los datos y habilita el formulario si el correo ya está registrado', async () => {
    const wrapper = mountDashboard();
    await flushPromises();
    await wrapper.get('.page-heading .button').trigger('click');
    await wrapper.get('.modal-body input[type="text"]').setValue('Nueva Docente');
    await wrapper.get('.modal-body input[type="email"]').setValue('nueva.docente@unah.edu.hn');
    apiMock.mockRejectedValueOnce(new ApiError('Duplicate database key', 409));
    await wrapper.get('.modal-body').trigger('submit');
    await flushPromises();
    expect(wrapper.get('.modal-body [role="alert"]').text()).toBe('Ya existe una cuenta con ese correo.');
    expect((wrapper.get('.modal-body input[type="email"]').element as HTMLInputElement).value).toBe('nueva.docente@unah.edu.hn');
    expect(wrapper.get('.modal-body input[type="text"]').attributes('disabled')).toBeUndefined();
    expect(wrapper.get('.modal-body').attributes('aria-busy')).toBe('false');
    expect(wrapper.find('.modal-body .icon-spin').exists()).toBe(false);
  });
});
