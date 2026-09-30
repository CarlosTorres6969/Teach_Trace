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
    let confirmed = false;
    apiMock.mockImplementation((path: string, options?: { method?: string }) => {
      if (path === '/teacher/submissions/7/valuations/21' && options?.method === 'PUT') {
        confirmed = true;
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
        return Promise.resolve(baseImplementation?.(path)).then((detail) => ({
          ...(detail as Record<string, unknown>),
          teacherGradePercentage: confirmed ? 100 : null,
          valuations: [{
            id: 21,
            criterion: 'Argumentación',
            dimension: 'Análisis',
            aiValue: 3,
            aiExplanation: 'Evidencia suficiente.',
            teacherValue: confirmed ? 4 : null,
            teacherComment: '',
            confirmed,
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
    await wrapper.get('.valuation-editor select').setValue('4');
    await wrapper.get('.valuation-editor button').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Decisión docente confirmada100%');
    expect(apiMock).toHaveBeenCalledWith(
      '/teacher/submissions/7/valuations/21',
      expect.objectContaining({ method: 'PUT' }),
    );
  });
});
