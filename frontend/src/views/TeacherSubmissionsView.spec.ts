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
});
