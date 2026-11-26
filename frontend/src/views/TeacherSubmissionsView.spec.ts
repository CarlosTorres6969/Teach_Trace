// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TeacherSubmissionsView from './TeacherSubmissionsView.vue';

const { apiMock, apiBlobMock } = vi.hoisted(() => ({
  apiMock: vi.fn(),
  apiBlobMock: vi.fn(),
}));

vi.mock('../api', () => ({ api: apiMock, apiBlob: apiBlobMock }));
vi.mock('vue-router', () => ({ useRoute: () => ({ params: { id: '12' } }) }));

describe('TeacherSubmissionsView - resumen de prompts', () => {
  beforeEach(() => {
    apiMock.mockReset();
    apiBlobMock.mockReset();
    apiMock.mockImplementation((path: string) => {
      if (path === '/teacher/activities/12/submissions') {
        return Promise.resolve([
          {
            id: 7,
            student: { name: 'Estudiante', email: 'estudiante@unah.edu.hn' },
            status: 'submitted',
            evaluationStatus: 'not_requested',
            manualReviewRequired: false,
            submittedAt: '2026-09-01T12:00:00.000Z',
          },
        ]);
      }
      if (path === '/teacher/submissions/7') {
        return Promise.resolve({
          id: 7,
          student: { name: 'Estudiante', email: 'estudiante@unah.edu.hn' },
          activity: { title: 'Actividad de prueba' },
          status: 'submitted',
          evaluationStatus: 'not_requested',
          manualReviewRequired: false,
          submittedAt: '2026-09-01T12:00:00.000Z',
          productText: 'Producto académico',
          productUrl: '',
          fileName: null,
          feedback: '',
          aiStrengths: 'Argumentación clara.',
          aiImprovements: 'Profundizar la validación.',
          aiComparison: '',
          aiUnderstandingScore: 82,
          aiUnderstandingExplanation: 'Comprende el tema y el propósito con evidencia suficiente.',
          aiLearningOutcomeAssessments: [{
            learningOutcome: 'Argumenta una solución usando evidencia verificable.',
            score: 82,
            explanation: 'Relaciona la conclusión con evidencia concreta.',
            evidence: ['Contrasta dos casos en el producto final.'],
          }],
          aiSuggestedGradePercentage: 66.67,
          teacherGradePercentage: null,
          aiPromptAssessment: {
            scorePercentage: 66.67,
            summary: 'Los prompts son pertinentes y deben mejorar la verificación.',
            dimensions: {
              relevance: 4,
              clarity: 3,
              refinement: 3,
              verification: 2,
              criticalThinking: 3,
            },
            prompts: [
              {
                sequence: 2,
                content: 'Segundo prompt para refinar la conclusión.',
                purpose: 'refinement',
                score: 3,
                explanation: 'Refina el resultado anterior.',
              },
              {
                sequence: 0,
                content: '',
                purpose: 'verification',
                score: 3,
                explanation: 'Solicita una verificación concreta.',
              },
            ],
          },
          aiAnalyzedAt: '2026-09-01T13:00:00.000Z',
          valuations: [],
          aiConversation: {
            messages: [
              {
                id: 4,
                role: 'ai',
                content: 'Segunda respuesta.',
                sequence: 3,
                createdAt: '2026-09-01T12:03:00.000Z',
              },
              {
                id: 3,
                role: 'student',
                content: 'Segundo prompt para refinar la conclusión.',
                sequence: 2,
                createdAt: '2026-09-01T12:02:00.000Z',
              },
              {
                id: 2,
                role: 'ai',
                content: 'Primera respuesta.',
                sequence: 1,
                createdAt: '2026-09-01T12:01:00.000Z',
              },
              {
                id: 1,
                role: 'student',
                content: 'Primer prompt para contrastar evidencia.',
                sequence: 0,
                createdAt: '2026-09-01T12:00:00.000Z',
              },
            ],
          },
          logbook: null,
          aiDeclaration: {
            toolName: 'ChatGPT',
            usageLevel: 2,
            detectedUsageLevel: null,
            usageDiscrepancy: false,
            purpose: 'Contrastar fuentes',
            promptSummary: 'Primer prompt.\n\nSegundo prompt.',
          },
        });
      }
      return Promise.reject(new Error(`Solicitud no esperada: ${path}`));
    });
  });

  function publishedGrade() {
    const base = apiMock.getMockImplementation()!;
    const valuation = {
      id: 21, criterion: 'Argumentación', dimension: 'Análisis',
      aiValue: 2, aiExplanation: 'Sugerencia original de IA.',
      teacherValue: 3, teacherComment: 'Comentario publicado', confirmed: true,
    };
    apiMock.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === '/teacher/submissions/7/valuations/21' && options?.method === 'PUT') {
        Object.assign(valuation, JSON.parse(String(options.body)));
        return { ...valuation };
      }
      const result = await base(path, options);
      return path === '/teacher/submissions/7'
        ? { ...result, status: 'evaluated', evaluationStatus: 'validated', teacherGradePercentage: 66.67, feedback: 'Retroalimentación publicada', valuations: [{ ...valuation }] }
        : result;
    });
    return valuation;
  }

  async function openPublishedGrade() {
    const wrapper = mount(TeacherSubmissionsView, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    });
    await flushPromises();
    await wrapper.get('.submission-list button').trigger('click');
    await flushPromises();
    return wrapper;
  }

  it('corrige la nota publicada y mantiene la evaluación publicada', async () => {
    const valuation = publishedGrade();
    const wrapper = await openPublishedGrade();
    const controls = wrapper.get('.published-grade-editor');
    expect(wrapper.get('.valuation-editor select').attributes('disabled')).toBeDefined();
    expect(wrapper.find('.valuation-editor button').exists()).toBe(false);
    await controls.get('button').trigger('click');
    expect(controls.text()).toContain('guarda cada criterio');
    expect(wrapper.get('.valuation-editor select').attributes('disabled')).toBeUndefined();
    await wrapper.get('.valuation-editor select').setValue('4');
    await wrapper.get('.valuation-editor textarea').setValue('Corrección revisada');
    let resolve!: (value: unknown) => void;
    const pending = new Promise((done) => { resolve = done; });
    apiMock.mockImplementationOnce(() => pending);
    await wrapper.get('.valuation-editor button').trigger('click');
    expect(controls.get('button').attributes('disabled')).toBeDefined();
    expect(wrapper.get('.valuation-editor select').attributes('disabled')).toBeDefined();
    expect(apiMock).toHaveBeenLastCalledWith('/teacher/submissions/7/valuations/21', {
      method: 'PUT', body: JSON.stringify({ teacherValue: 4, teacherComment: 'Corrección revisada' }),
    });
    resolve({ ...valuation, teacherValue: 4, teacherComment: 'Corrección revisada' });
    await flushPromises();
    expect(wrapper.text()).toContain('Decisión docente confirmada100%');
    expect(wrapper.get('.valuation-save-toast').text()).toContain('Nota publicada actualizada');
    expect(wrapper.get('.valuation-panel-header [data-status="evaluated"]').text()).toBe('Publicada');
    expect(wrapper.find('.valuation-close-row').exists()).toBe(false);
    expect(wrapper.text()).toContain('Sugerencia original de IA.');
    await controls.get('button').trigger('click');
    expect(wrapper.get('.valuation-editor select').attributes('disabled')).toBeDefined();
    expect((wrapper.get('.valuation-editor select').element as HTMLSelectElement).value).toBe('4');
    wrapper.unmount();
  });

  it('descarta únicamente los cambios de nota que no se hayan guardado', async () => {
    publishedGrade();
    const wrapper = await openPublishedGrade();
    await wrapper.get('.published-grade-editor button').trigger('click');
    await wrapper.get('.valuation-editor select').setValue('4');
    await wrapper.get('.valuation-editor textarea').setValue('Borrador sin guardar');
    await wrapper.get('.published-grade-editor button').trigger('click');
    expect((wrapper.get('.valuation-editor select').element as HTMLSelectElement).value).toBe('3');
    expect((wrapper.get('.valuation-editor textarea').element as HTMLTextAreaElement).value).toBe('Comentario publicado');
    expect(wrapper.text()).toContain('Decisión docente confirmada66.67%');
    expect(apiMock.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(false);
    wrapper.unmount();
  });

  it('conserva la nota publicada si falla el guardado y permite reintentar', async () => {
    publishedGrade();
    const wrapper = await openPublishedGrade();
    await wrapper.get('.published-grade-editor button').trigger('click');
    await wrapper.get('.valuation-editor select').setValue('4');
    apiMock.mockRejectedValueOnce(new Error('No fue posible guardar la corrección'));
    await wrapper.get('.valuation-editor button').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('No fue posible guardar la corrección');
    expect(wrapper.text()).toContain('Decisión docente confirmada66.67%');
    expect(wrapper.get('.valuation-editor button').attributes('disabled')).toBeUndefined();
    await wrapper.get('.valuation-editor button').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Decisión docente confirmada100%');
    wrapper.unmount();
  });

  it('vuelve a bloquear los campos al abrir otra vez una entrega publicada', async () => {
    publishedGrade();
    const wrapper = await openPublishedGrade();
    await wrapper.get('.published-grade-editor button').trigger('click');
    await wrapper.get('.submission-list button').trigger('click');
    await flushPromises();
    expect(wrapper.get('.published-grade-editor button').text()).toBe('Editar nota publicada');
    expect(wrapper.get('.valuation-editor select').attributes('disabled')).toBeDefined();
    wrapper.unmount();
  });

  it('descarga desde Azure sin pasar el PDF grande por la API', async () => {
    const baseImplementation = apiMock.getMockImplementation()!;
    apiMock.mockImplementation(async (path: string) => {
      if (path === '/teacher/submissions/7/file-download') {
        return { url: 'https://storage.example/trabajo.pdf?read-only' };
      }
      const result = await baseImplementation(path);
      return path === '/teacher/submissions/7' ? { ...result, fileName: 'trabajo.pdf' } : result;
    });
    let clickedAnchor: HTMLAnchorElement | undefined;
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clickedAnchor = this;
    });
    try {
      const wrapper = mount(TeacherSubmissionsView, {
        global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
      });
      await flushPromises();
      await wrapper.get('.submission-list button').trigger('click');
      await flushPromises();
      await wrapper.findAll('button').find((button) => button.text().includes('Descargar trabajo.pdf'))!.trigger('click');
      await flushPromises();
      expect(apiMock).toHaveBeenCalledWith('/teacher/submissions/7/file-download');
      expect(apiBlobMock).not.toHaveBeenCalled();
      expect(click).toHaveBeenCalledOnce();
      const anchor = clickedAnchor!;
      expect(anchor.href).toBe('https://storage.example/trabajo.pdf?read-only');
      expect(anchor.referrerPolicy).toBe('no-referrer');
      wrapper.unmount();
    } finally {
      click.mockRestore();
    }
  });

  it('muestra al docente el resumen de prompts persistido', async () => {
    const wrapper = mount(TeacherSubmissionsView, {
      global: {
        stubs: { RouterLink: { template: '<a><slot /></a>' } },
      },
    });
    await flushPromises();
    await wrapper.get('.submission-list button').trigger('click');
    await flushPromises();

    const labels = wrapper.findAll('dt').map((item) => item.text());
    const values = wrapper.findAll('dd');
    const summaryIndex = labels.indexOf('Resumen de prompts');
    expect(summaryIndex).toBeGreaterThanOrEqual(0);
    expect(values[summaryIndex].text()).toBe('Primer prompt.\n\nSegundo prompt.');
  });

  it('informa correctamente cuando un lote queda analizado solo de forma parcial', async () => {
    const baseImplementation = apiMock.getMockImplementation();
    apiMock.mockImplementation((path: string) => {
      if (path === '/entregas/actividad/12/evaluar') {
        return Promise.resolve({
          implemented: true,
          processed: 2,
          analyzed: 1,
          failed: 1,
          pendingManualReview: 2,
          reason: 'El proveedor de IA respondió HTTP 503',
        });
      }
      return baseImplementation?.(path);
    });
    const wrapper = mount(TeacherSubmissionsView, {
      global: {
        stubs: { RouterLink: { template: '<a><slot /></a>' } },
      },
    });
    await flushPromises();

    const analyzeButton = wrapper.findAll('button').find((button) =>
      button.text().includes('Analizar con IA'),
    );
    expect(analyzeButton).toBeDefined();
    await analyzeButton!.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Análisis parcial: 1 entrega(s) analizadas y 1 pendientes');
    expect(wrapper.text()).toContain('HTTP 503');
  });

  it('ofrece regreso directo a actividades y aprovecha el ancho de la pantalla', async () => {
    const wrapper = mount(TeacherSubmissionsView, {
      global: {
        stubs: { RouterLink: { template: '<a><slot /></a>' } },
      },
    });
    await flushPromises();

    expect(wrapper.get('.teacher-submissions-nav').text()).toContain('Regresar a actividades');
    expect(wrapper.classes()).toContain('teacher-submissions-page');
    expect(wrapper.findAll('.teacher-submissions-nav .ui-icon')).toHaveLength(2);
  });

  it('muestra comprensión, nota sugerida y valoración cronológica de prompts', async () => {
    const wrapper = mount(TeacherSubmissionsView, {
      global: {
        stubs: { RouterLink: { template: '<a><slot /></a>' } },
      },
    });
    await flushPromises();
    await wrapper.get('.submission-list button').trigger('click');
    await flushPromises();

    const text = wrapper.text();
    expect(text).toContain('Comprensión del tema y propósito');
    expect(text).toContain('82/100');
    expect(text).toContain('Argumenta una solución usando evidencia verificable.');
    expect(text).toContain('Contrasta dos casos en el producto final.');
    expect(text).toContain('no constituye una calificación');
    expect(text).toContain('Sugerencia porcentual de la IA');
    expect(text).toContain('Sugerencia IA66.67%');
    expect(text).toContain('Decisión docente confirmadaPendiente');
    expect(text).toContain('no publica ni reemplaza la calificación');
    expect(text).toContain('Valoración de prompts');
    expect(text).toContain('66.67%');
    expect(text).toContain('Pertinencia4/4');
    expect(text).toContain('Verificación2/4');

    const transcript = wrapper.findAll('.conversation-transcript li').map((item) => item.text());
    expect(transcript).toEqual([
      'EstudiantePrimer prompt para contrastar evidencia.',
      'IAPrimera respuesta.',
      'EstudianteSegundo prompt para refinar la conclusión.',
      'IASegunda respuesta.',
    ]);
    const orderedPrompts = wrapper.findAll('.ordered-prompt-list li');
    expect(orderedPrompts).toHaveLength(2);
    expect(orderedPrompts[0].text()).toContain('Prompt 1 · Verificación');
    expect(orderedPrompts[0].text()).toContain('Primer prompt para contrastar evidencia.');
    expect(orderedPrompts[1].text()).toContain('Prompt 2 · Refinamiento');
  });

  it('actualiza la decisión porcentual después de confirmar el criterio docente', async () => {
    const baseImplementation = apiMock.getMockImplementation();
    let detailRequests = 0;
    apiMock.mockImplementation((path: string, options?: { method?: string }) => {
      if (path === '/teacher/submissions/7/valuations/21' && options?.method === 'PUT') {
        return Promise.resolve({
          id: 21,
          criterion: 'Argumentación',
          dimension: 'Análisis',
          aiValue: 3,
          aiExplanation: 'Evidencia suficiente.',
          teacherValue: 4,
          teacherComment: '',
          confirmed: true,
        });
      }
      if (path === '/teacher/submissions/7') {
        detailRequests += 1;
        return Promise.resolve(baseImplementation?.(path)).then((detail) => ({
          ...(detail as Record<string, unknown>),
          teacherGradePercentage: null,
          valuations: [{
            id: 21,
            criterion: 'Argumentación',
            dimension: 'Análisis',
            aiValue: 3,
            aiExplanation: 'Evidencia suficiente.',
            teacherValue: null,
            teacherComment: '',
            confirmed: false,
          }],
        }));
      }
      return baseImplementation?.(path);
    });
    const wrapper = mount(TeacherSubmissionsView, {
      global: {
        stubs: { RouterLink: { template: '<a><slot /></a>' } },
      },
    });
    await flushPromises();
    await wrapper.get('.submission-list button').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Decisión docente confirmadaPendiente');
    expect(wrapper.find('.valuation-grid').exists()).toBe(true);
    expect(wrapper.get('.valuation-editor button .ui-icon').element.tagName.toLowerCase()).toBe('svg');
    const confirmButton = wrapper.get('.valuation-editor button');
    await wrapper.get('.valuation-editor select').setValue('4');
    await confirmButton.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Decisión docente confirmada100%');
    expect(detailRequests).toBe(1);
    expect(wrapper.get('.valuation-editor button').element).toBe(confirmButton.element);
    expect(wrapper.text()).toContain('Evidencia suficiente.');
    expect(wrapper.get('.valuation-save-toast').text()).toContain('Criterio "Argumentación" guardado');
    expect(apiMock).toHaveBeenCalledWith(
      '/teacher/submissions/7/valuations/21',
      expect.objectContaining({ method: 'PUT' }),
    );
  });
});
