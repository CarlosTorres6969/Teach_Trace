// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StudentActivityView from './StudentActivityView.vue';

const { apiMock } = vi.hoisted(() => ({ apiMock: vi.fn() }));

vi.mock('../api', () => ({ api: apiMock }));
vi.mock('vue-router', () => ({ useRoute: () => ({ params: { id: '12' } }) }));

describe('StudentActivityView - nivel declarado de IA', () => {
  beforeEach(() => {
    apiMock.mockReset();
    apiMock.mockImplementation((path: string, options?: RequestInit) => {
      if (path.endsWith('/logbook')) {
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

    await wrapper.get('textarea[maxlength="50000"]').setValue('Producto académico');
    await wrapper.get('input[placeholder^="Ej."]').setValue('ChatGPT');
    await wrapper.get('textarea[maxlength="5000"]').setValue('Contrastar fuentes');
    await wrapper.get('textarea[maxlength="10000"]').setValue('Comparar argumentos');
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
    await wrapper.get('textarea[maxlength="10000"]').setValue('Comparar argumentos');
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

  it('exige un resumen de prompts y conserva sus párrafos al entregar', async () => {
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
    await wrapper.get('textarea[maxlength="5000"]').setValue('Contrastar fuentes');
    const summary = wrapper.get('textarea[maxlength="10000"]');
    expect(summary.attributes('required')).toBeDefined();
    expect(summary.attributes('maxlength')).toBe('10000');
    expect(wrapper.text()).not.toContain('Opcional');
    await summary.setValue('   ');
    apiMock.mockClear();

    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(wrapper.text()).toContain('Escribe un resumen de los prompts utilizados.');
    expect(apiMock).not.toHaveBeenCalled();

    await summary.setValue('  Primer prompt.\n\nSegundo prompt.  ');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    const submissionCall = apiMock.mock.calls.find(([path]) =>
      String(path).endsWith('/submission'),
    );
    const form = submissionCall?.[1]?.body as FormData;
    expect(form.get('promptSummary')).toBe('Primer prompt.\n\nSegundo prompt.');
  });
});
