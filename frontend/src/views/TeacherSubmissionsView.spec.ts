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
          aiAnalyzedAt: '2026-09-01T13:00:00.000Z',
          aiStrengths: 'Buena argumentación.',
          aiImprovements: 'Debe verificar mejor las fuentes.',
          aiComparison: 'El uso declarado coincide con la evidencia.',
          aiUnderstandingScore: 82,
          aiUnderstandingExplanation: 'Comprende el propósito principal de la actividad.',
          aiLearningOutcomeAssessments: [{
            learningOutcome: 'Analiza evidencia académica',
            score: 82,
            explanation: 'Relaciona evidencia y conclusiones.',
            evidence: ['Presenta una validación concreta.'],
          }],
          aiPromptAssessment: {
            scorePercentage: 75,
            summary: 'Los prompts son pertinentes y requieren mayor verificación.',
            dimensions: {
              relevance: 4,
              clarity: 3,
              refinement: 3,
              verification: 2,
              criticalThinking: 3,
            },
            prompts: [{
              sequence: 0,
              purpose: 'verification',
              score: 3,
              explanation: 'Solicita contraste de la conclusión.',
            }],
          },
          aiSuggestedGradePercentage: 75,
          teacherGradePercentage: null,
          valuations: [{
            id: 21,
            criterion: 'Argumentación',
            dimension: 'Análisis',
            aiValue: 3,
            aiExplanation: 'Relaciona evidencia y conclusiones.',
            teacherValue: null,
            teacherComment: '',
            confirmed: false,
          }],
          aiConversation: {
            messages: [
              {
                id: 1,
                role: 'student',
                content: 'Contrasta mi conclusión con la evidencia.',
                sequence: 0,
                createdAt: '2026-09-01T12:00:00.000Z',
              },
              {
                id: 2,
                role: 'ai',
                content: 'La conclusión puede reforzarse con otra fuente.',
                sequence: 1,
                createdAt: '2026-09-01T12:01:00.000Z',
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

  it('muestra comprensión, nota sugerida y valoración cronológica de prompts', async () => {
    const wrapper = mount(TeacherSubmissionsView, {
      global: {
        stubs: { RouterLink: { template: '<a><slot /></a>' } },
      },
    });
    await flushPromises();
    await wrapper.get('.submission-list button').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Comprensión estimada');
    expect(wrapper.text()).toContain('82/100');
    expect(wrapper.text()).toContain('Sugerencia IA75%');
    expect(wrapper.text()).toContain('Analiza evidencia académica');
    expect(wrapper.text()).toContain('Calidad del proceso de prompting');
    expect(wrapper.text()).toContain('Verificación');
    expect(wrapper.text()).toContain('Contrasta mi conclusión con la evidencia.');
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
});
