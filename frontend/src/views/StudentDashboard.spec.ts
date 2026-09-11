// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSession, setSession } from '../auth';
import StudentDashboard from './StudentDashboard.vue';

const { apiMock } = vi.hoisted(() => ({ apiMock: vi.fn() }));
vi.mock('../api', () => ({ api: apiMock }));

function dateAfter(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

describe('StudentDashboard - HU-22, HU-23 y HU-24', () => {
  beforeEach(() => {
    setSession({
      id: 7,
      email: 'estudiante@unah.edu.hn',
      name: 'Ana',
      role: 'student',
      theme: 'light',
      accessibilitySettings: { fontSize: 100, highContrast: false, reducedMotion: false },
    }, false);
    apiMock.mockReset();
    apiMock.mockResolvedValue([
      {
        id: 1,
        title: 'Proyecto urgente',
        subject: 'Programación',
        dueDate: dateAfter(1),
        weight: 1,
        finalScore: null,
        academicClass: { id: 3, name: 'Programación II', code: 'IS-210' },
        submissionStatus: 'not_submitted',
        completionPercentage: 40,
        missingSections: ['declaración IA', 'producto final'],
        logbookStatus: 'complete',
        isNew: true,
      },
      {
        id: 2,
        title: 'Ensayo completado',
        subject: 'Programación',
        dueDate: dateAfter(3),
        weight: 1,
        finalScore: null,
        academicClass: { id: 3, name: 'Programación II', code: 'IS-210' },
        submissionStatus: 'submitted',
        completionPercentage: 100,
        missingSections: [],
        logbookStatus: 'complete',
        isNew: false,
      },
    ]);
  });

  afterEach(() => clearSession(false));

  it('usa semana por defecto y muestra contador, urgencia, progreso y nuevas', async () => {
    const wrapper = mount(StudentDashboard, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
          ProjectionWidget: { template: '<div />' },
          EvolutionChart: { template: '<div />' },
        },
      },
    });
    await flushPromises();

    expect(apiMock).toHaveBeenCalledWith('/student/activities?filter=week');
    expect(wrapper.text()).toContain('1 entrega pendiente esta semana');
    expect(wrapper.text()).toContain('Proyecto urgente');
    expect(wrapper.text()).toContain('Menos de 48 h');
    expect(wrapper.text()).toContain('Nuevo');
    expect(wrapper.text()).toContain('40%');
    expect(wrapper.text()).toContain('Faltan: declaración IA, producto final');
    expect(wrapper.text()).not.toContain('Ensayo completado');

    await wrapper.get('.completed-toggle').trigger('click');
    expect(wrapper.text()).toContain('Ensayo completado');

    const monthButton = wrapper.findAll('.filter-button').find((button) =>
      button.text().includes('Este mes'),
    );
    await monthButton?.trigger('click');
    await flushPromises();
    expect(apiMock).toHaveBeenCalledWith('/student/activities?filter=month');
  });
});
