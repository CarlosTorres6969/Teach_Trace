// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StudentActivityView from './StudentActivityView.vue';

const { apiMock, routeLeaveGuards } = vi.hoisted(() => ({
  apiMock: vi.fn(),
  routeLeaveGuards: [] as Array<() => Promise<void>>,
}));

vi.mock('../api', () => ({ api: apiMock }));
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: '12' } }),
  onBeforeRouteLeave: (guard: () => Promise<void>) => routeLeaveGuards.push(guard),
}));

describe('StudentActivityView - nivel declarado de IA', () => {
  beforeEach(() => {
    window.localStorage.clear();
    routeLeaveGuards.length = 0;
    apiMock.mockReset();
    apiMock.mockImplementation((path: string, options?: RequestInit) => {
      if (path.endsWith('/logbook')) {
        if (options?.method === 'PUT') {
          return Promise.resolve(JSON.parse(String(options.body)));
        }
        return Promise.resolve({
          activity: { title: 'Actividad de prueba' },
          initialIdeas: 'Ideas iniciales',
          prompts: 'Prompt utilizado',
          validationsAndDecisions: 'Validaciones y decisiones',
          finalReflection: 'Reflexión final',
        });
      }
      if (path.endsWith('/ai-declaration')) {
        return Promise.resolve({
          toolName: '',
          usageLevel: null,
          purpose: '',
          promptSummary: '',
        });
      }
      if (path.endsWith('/submission-status')) {
        return Promise.resolve({
          status: 'not_submitted',
          submittedAt: null,
          productText: '',
          productUrl: '',
          fileName: null,
          evaluationStatus: 'not_requested',
          manualReviewRequired: false,
        });
      }
      if (path.endsWith('/ai-conversation')) {
        if (options?.method === 'PUT') {
          return Promise.resolve(JSON.parse(String(options.body)));
        }
        const messages = [
          { role: 'student', content: 'Prompt de prueba' },
          { role: 'ai', content: 'Respuesta de prueba' },
        ];
        return Promise.resolve({ messages });
      }
      if (path.endsWith('/submission') && options?.method === 'PUT') {
        return Promise.resolve({ status: 'submitted', submittedAt: new Date().toISOString() });
      }
      return Promise.reject(new Error(`Solicitud no esperada: ${path}`));
    });
  });

  async function attachPdf(wrapper: ReturnType<typeof mount>) {
    const input = wrapper.get('input[type="file"]');
    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [new File(['%PDF-1.4'], 'tarea.pdf', { type: 'application/pdf' })],
    });
    await input.trigger('change');
  }

  it('calcula el progreso con pasos guardados y no con el paso actualmente visible', async () => {
    const wrapper = mount(StudentActivityView, {
      global: {
        stubs: { RouterLink: { template: '<a><slot /></a>' } },
      },
    });
    await flushPromises();

    expect(wrapper.get('.logbook-progress-label').text()).toContain('4 de 5 pasos completados');
    expect(wrapper.get('.logbook-progress').attributes('aria-valuenow')).toBe('4');
    expect(wrapper.get('.logbook-progress span').attributes('style')).toContain('80%');
    expect(wrapper.findAll('.step-save-status').map((item) => item.text())).toEqual([
      'Guardado',
      'Guardado',
      'Guardado',
      'Guardado',
      'Pendiente',
    ]);
    expect(wrapper.get('.progress-checklist').text()).toContain('Entrega final');

    await wrapper.get('.logbook-step-content textarea').setValue('Idea modificada sin guardar');
    expect(wrapper.get('.logbook-progress-label').text()).toContain('3 de 5 pasos completados');
    expect(wrapper.findAll('.step-save-status')[0].text()).toBe('Sin guardar');
    expect(wrapper.get('.progress-checklist').text()).toContain('Ideas iniciales');

    await wrapper.get('.logbook-actions .button.secondary').trigger('click');
    await flushPromises();

    expect(wrapper.get('.logbook-progress-label').text()).toContain('4 de 5 pasos completados');
    expect(wrapper.findAll('.step-save-status')[0].text()).toBe('Guardado');
    expect(wrapper.get('.progress-checklist').text()).not.toContain('Ideas iniciales');
  });

  it('enumera los pasos incompletos que todavía hacen falta', async () => {
    const wrapper = mount(StudentActivityView, {
      global: {
        stubs: { RouterLink: { template: '<a><slot /></a>' } },
      },
    });
    await flushPromises();

    await wrapper.findAll('.logbook-step-button')[2].trigger('click');
    await wrapper.get('.logbook-step-content textarea').setValue('');

    const checklist = wrapper.get('.progress-checklist').text();
    expect(checklist).toContain('Validaciones y decisiones');
    expect(checklist).toContain('Entrega final');
    expect(wrapper.findAll('.step-save-status')[2].text()).toBe('Pendiente');
    expect(wrapper.get('.logbook-progress').attributes('aria-valuenow')).toBe('3');
  });

  it('guarda conjuntamente el resumen y la conversación con el botón general Guardar progreso', async () => {
    const wrapper = mount(StudentActivityView, {
      global: {
        stubs: { RouterLink: { template: '<a><slot /></a>' } },
      },
    });
    await flushPromises();

    await wrapper.findAll('.logbook-step-button')[1].trigger('click');
    await wrapper.get('textarea[maxlength="10000"]').setValue('Resumen actualizado');
    const conversationTextareas = wrapper.findAll('.conversation-message textarea');
    await conversationTextareas[0].setValue('Prompt actualizado');

    expect(wrapper.findAll('.step-save-status')[1].text()).toBe('Sin guardar');
    expect(wrapper.text()).not.toContain('Guardar paso 2');
    apiMock.mockClear();
    const saveProgress = wrapper.findAll('.logbook-actions button')
      .find((button) => button.text() === 'Guardar progreso');
    expect(saveProgress).toBeDefined();
    await saveProgress!.trigger('click');
    await flushPromises();

    expect(apiMock.mock.calls.some(([path, options]) =>
      String(path).endsWith('/logbook') && options?.method === 'PUT',
    )).toBe(true);
    expect(apiMock.mock.calls.some(([path, options]) =>
      String(path).endsWith('/ai-conversation') && options?.method === 'PUT',
    )).toBe(true);
    expect(wrapper.findAll('.step-save-status')[1].text()).toBe('Guardado');
    expect(wrapper.get('.logbook-progress-label').text()).toContain('4 de 5 pasos completados');
    expect(wrapper.text()).toContain('Progreso guardado correctamente.');
    expect(wrapper.get('.step-guidance').text()).toContain('Este paso está guardado correctamente.');
  });

  it('indica qué información falta en cada paso antes de intentar guardarlo', async () => {
    const wrapper = mount(StudentActivityView, {
      global: {
        stubs: { RouterLink: { template: '<a><slot /></a>' } },
      },
    });
    await flushPromises();

    const expectedMessages = [
      'Escribe tus ideas iniciales',
      'Escribe el resumen de prompts',
      'Describe al menos una validación o decisión',
      'Escribe tu reflexión final',
    ];

    for (let index = 0; index < expectedMessages.length; index += 1) {
      await wrapper.findAll('.logbook-step-button')[index].trigger('click');
      await wrapper.get('.logbook-step-content > label textarea').setValue('');
      expect(wrapper.get('.step-guidance').text()).toContain(expectedMessages[index]);
    }

    await wrapper.get('.submission-step-button').trigger('click');
    expect(wrapper.get('.step-guidance').text()).toContain('adjuntar el archivo PDF');
    expect(wrapper.get('.step-guidance').text()).toContain('indicar la herramienta de IA');
    expect(wrapper.get('.step-guidance').text()).toContain('seleccionar el nivel de uso de IA');
    expect(wrapper.get('.step-guidance').text()).toContain('describir el propósito de uso de IA');
  });

  it('inicia sin nivel y exige que el estudiante seleccione uno antes de entregar', async () => {
    const wrapper = mount(StudentActivityView, {
      global: {
        stubs: { RouterLink: { template: '<a><slot /></a>' } },
      },
    });
    await flushPromises();
    await wrapper.get('.submission-step-button').trigger('click');
    await attachPdf(wrapper);

    const select = wrapper.get('select');
    const placeholder = select.get('option');
    expect(select.attributes('required')).toBeDefined();
    expect((select.element as HTMLSelectElement).value).toBe('');
    expect(placeholder.attributes('disabled')).toBeDefined();
    expect(placeholder.text()).toContain('Selecciona un nivel');
    expect(select.text()).toContain('Nivel 1 - Autor propio');
    expect(select.text()).toContain('Nivel 2 - Uso mínimo');
    expect(select.text()).toContain('Nivel 3 - Hecho por IA');

    await wrapper.get('textarea[maxlength="50000"]').setValue('Producto académico');
    await wrapper.get('input[placeholder^="Ej."]').setValue('ChatGPT');
    await wrapper.get('textarea[maxlength="5000"]').setValue('Contrastar fuentes');
    apiMock.mockClear();

    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(wrapper.text()).toContain('Selecciona tu nivel declarado de uso de IA.');
    expect(apiMock).not.toHaveBeenCalled();

    await select.setValue('2');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    const submissionCall = apiMock.mock.calls.find(([path]) =>
      String(path).endsWith('/submission'),
    );
    expect(submissionCall).toBeDefined();
    const form = submissionCall?.[1]?.body as FormData;
    expect(form.get('usageLevel')).toBe('2');
  });

  it('rechaza un propósito con espacios y conserva los párrafos del propósito válido', async () => {
    const wrapper = mount(StudentActivityView, {
      global: {
        stubs: { RouterLink: { template: '<a><slot /></a>' } },
      },
    });
    await flushPromises();
    await wrapper.get('.submission-step-button').trigger('click');
    await attachPdf(wrapper);

    await wrapper.get('textarea[maxlength="50000"]').setValue('Producto académico');
    await wrapper.get('input[placeholder^="Ej."]').setValue('ChatGPT');
    await wrapper.get('select').setValue('2');
    const purpose = wrapper.get('textarea[maxlength="5000"]');
    expect(purpose.attributes('required')).toBeDefined();
    expect(purpose.attributes('maxlength')).toBe('5000');
    await purpose.setValue('   ');
    apiMock.mockClear();

    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(wrapper.text()).toContain('Describe el propósito para el cual utilizaste IA.');
    expect(apiMock).not.toHaveBeenCalled();

    await purpose.setValue('  Primer párrafo.\n\nSegundo párrafo.  ');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    const submissionCall = apiMock.mock.calls.find(([path]) =>
      String(path).endsWith('/submission'),
    );
    const form = submissionCall?.[1]?.body as FormData;
    expect(form.get('purpose')).toBe('Primer párrafo.\n\nSegundo párrafo.');
  });

  it('captura los prompts y la conversación solo en el paso 2 y reutiliza el resumen al entregar', async () => {
    const wrapper = mount(StudentActivityView, {
      global: {
        stubs: { RouterLink: { template: '<a><slot /></a>' } },
      },
    });
    await flushPromises();

    await wrapper.findAll('.logbook-step-button')[1].trigger('click');
    await flushPromises();
    const summary = wrapper.get('textarea[maxlength="10000"]');
    expect(wrapper.text()).toContain('Resumen de prompts');
    expect(wrapper.text()).toContain('Conversación con IA');
    expect(summary.attributes('maxlength')).toBe('10000');
    await summary.setValue('  Primer prompt.\n\nSegundo prompt.  ');

    await wrapper.get('.submission-step-button').trigger('click');
    await flushPromises();
    await attachPdf(wrapper);

    expect(wrapper.text()).not.toContain('Resumen de prompts');
    expect(wrapper.text()).not.toContain('Conversación con IA');
    await wrapper.get('textarea[maxlength="50000"]').setValue('Producto académico');
    await wrapper.get('input[placeholder^="Ej."]').setValue('ChatGPT');
    await wrapper.get('select').setValue('2');
    await wrapper.get('textarea[maxlength="5000"]').setValue('Contrastar fuentes');
    apiMock.mockClear();

    await wrapper.get('form').trigger('submit');
    await flushPromises();

    const submissionCall = apiMock.mock.calls.find(([path]) =>
      String(path).endsWith('/submission'),
    );
    const form = submissionCall?.[1]?.body as FormData;
    expect(form.get('promptSummary')).toBe('Primer prompt.\n\nSegundo prompt.');
  });

  it('guarda la bitácora al salir de la actividad', async () => {
    const wrapper = mount(StudentActivityView, {
      global: {
        stubs: { RouterLink: { template: '<a><slot /></a>' } },
      },
    });
    await flushPromises();
    await wrapper.get('.logbook-step-content textarea').setValue('Avance antes de salir');
    apiMock.mockClear();

    await routeLeaveGuards[0]();
    await flushPromises();

    const saveCall = apiMock.mock.calls.find(([path, options]) =>
      String(path).endsWith('/logbook') && options?.method === 'PUT',
    );
    expect(saveCall).toBeDefined();
    expect(JSON.parse(String(saveCall?.[1]?.body))).toMatchObject({
      initialIdeas: 'Avance antes de salir',
    });
  });

  it('recupera los campos todavía no entregados cuando el estudiante vuelve a la actividad', async () => {
    const firstVisit = mount(StudentActivityView, {
      global: {
        stubs: { RouterLink: { template: '<a><slot /></a>' } },
      },
    });
    await flushPromises();
    await firstVisit.get('.submission-step-button').trigger('click');
    await flushPromises();
    await firstVisit.get('textarea[maxlength="50000"]').setValue('Producto aún no entregado');
    await firstVisit.get('input[placeholder^="Ej."]').setValue('ChatGPT');
    await firstVisit.get('select').setValue('2');
    await firstVisit.get('textarea[maxlength="5000"]').setValue('Revisar el enfoque');
    await flushPromises();
    firstVisit.unmount();

    routeLeaveGuards.length = 0;
    const secondVisit = mount(StudentActivityView, {
      global: {
        stubs: { RouterLink: { template: '<a><slot /></a>' } },
      },
    });
    await flushPromises();

    expect(secondVisit.get('textarea[maxlength="50000"]').element).toHaveProperty(
      'value',
      'Producto aún no entregado',
    );
    expect(secondVisit.get('input[placeholder^="Ej."]').element).toHaveProperty('value', 'ChatGPT');
    expect((secondVisit.get('select').element as HTMLSelectElement).value).toBe('2');
  });
});
