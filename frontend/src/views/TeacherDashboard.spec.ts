import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import TeacherDashboard from './TeacherDashboard.vue';

vi.mock('../api', () => ({ api: vi.fn() }));
vi.mock('../auth', () => ({ auth: { user: { id: 1, name: 'Docente de prueba' } } }));
vi.mock('read-excel-file', () => ({ default: vi.fn() }));

const apiMock = vi.mocked(api);

const classes = [
  {
    id: 2,
    code: 'IS-202',
    name: 'Ingeniería del Software',
    subject: 'Ingeniería del Software',
    period: '2026-III',
    studentCount: 12,
    students: [],
  },
  {
    id: 1,
    code: 'PW-101',
    name: 'Programación Web',
    subject: 'Programación Web',
    period: '2026-III',
    studentCount: 20,
    students: [],
  },
];

let currentActivities: Array<Record<string, unknown>>;

describe('TeacherDashboard - organización y eliminación de actividades', () => {
  beforeEach(() => {
    currentActivities = [
      {
        id: 12,
        title: 'Plan de pruebas',
        academicClass: { id: 2, code: 'IS-202', name: 'Ingeniería del Software' },
        dueDate: '2026-10-20',
        activityType: 'Proyecto',
        evaluationPhase: 'pilot',
        published: false,
        learningOutcomes: [],
        rubric: null,
      },
      {
        id: 11,
        title: 'Aplicación con Vue',
        academicClass: { id: 1, code: 'PW-101', name: 'Programación Web' },
        dueDate: '2026-10-10',
        activityType: 'Proyecto',
        evaluationPhase: 'pilot',
        published: false,
        learningOutcomes: [],
        rubric: null,
      },
    ];
    apiMock.mockReset();
    apiMock.mockImplementation(async (path, options = {}) => {
      if (path === '/teacher/classes') return classes as never;
      if (path === '/teacher/activities' && !options.method) return currentActivities as never;
      if (path === '/teacher/rubrics') return [] as never;
      if (path === '/teacher/activities/11' && options.method === 'DELETE') {
        currentActivities = currentActivities.filter((activity) => activity.id !== 11);
        return { id: 11, deleted: true } as never;
      }
      throw new Error(`Solicitud inesperada: ${path}`);
    });
  });

  async function mountActivities() {
    const wrapper = mount(TeacherDashboard, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    });
    await flushPromises();
    await wrapper.findAll('.teacher-tabs button')[1].trigger('click');
    return wrapper;
  }

  it('agrupa las actividades bajo la clase a la que pertenecen', async () => {
    const wrapper = await mountActivities();
    const groups = wrapper.findAll('.activity-class-group');

    expect(groups).toHaveLength(2);
    expect(groups[0].text()).toContain('IS-202');
    expect(groups[0].text()).toContain('Plan de pruebas');
    expect(groups[0].text()).not.toContain('Aplicación con Vue');
    expect(groups[1].text()).toContain('PW-101');
    expect(groups[1].text()).toContain('Aplicación con Vue');
  });

  it('confirma la eliminación, llama la API y retira la actividad del grupo', async () => {
    const wrapper = await mountActivities();
    const webGroup = wrapper.findAll('.activity-class-group')[1];
    const configureButton = webGroup
      .findAll('button')
      .find((button) => button.text() === 'Configurar');
    await configureButton?.trigger('click');

    const deleteButton = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Eliminar actividad');
    await deleteButton?.trigger('click');
    expect(wrapper.find('[role="alertdialog"]').text()).toContain('Aplicación con Vue');

    const confirmButton = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Sí, eliminar actividad');
    await confirmButton?.trigger('click');
    await flushPromises();

    expect(apiMock).toHaveBeenCalledWith('/teacher/activities/11', { method: 'DELETE' });
    expect(wrapper.text()).toContain('Actividad "Aplicación con Vue" eliminada');
    expect(wrapper.findAll('.activity-class-group')).toHaveLength(1);
    expect(wrapper.find('.activity-class-group').text()).not.toContain('Aplicación con Vue');
  });
});
