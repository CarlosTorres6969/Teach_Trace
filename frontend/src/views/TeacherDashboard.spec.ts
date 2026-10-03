import { flushPromises, mount } from '@vue/test-utils';
import readXlsxFile from 'read-excel-file';
import { nextTick } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import TeacherDashboard from './TeacherDashboard.vue';

const { routeMock } = vi.hoisted(() => ({
  routeMock: { query: {} as Record<string, string> },
}));

vi.mock('../api', () => ({ api: vi.fn() }));
vi.mock('../auth', () => ({ auth: { user: { id: 1, name: 'Docente de prueba' } } }));
vi.mock('read-excel-file', () => ({ default: vi.fn() }));
vi.mock('vue-router', () => ({ useRoute: () => routeMock }));

const apiMock = vi.mocked(api);
const readXlsxFileMock = vi.mocked(readXlsxFile);

const classes = [
  {
    id: 2,
    code: 'IS-202',
    name: 'Ingeniería del Software',
    section: '1200',
    period: '2026-III',
    studentCount: 12,
    students: [],
  },
  {
    id: 1,
    code: 'PW-101',
    name: 'Programación Web',
    section: '1300',
    period: '2026-III',
    studentCount: 20,
    students: [],
  },
];

let currentActivities: Array<Record<string, unknown>>;

describe('TeacherDashboard - organización y eliminación de actividades', () => {
  beforeEach(() => {
    routeMock.query = {};
    currentActivities = [
      {
        id: 12,
        title: 'Plan de pruebas',
        academicClass: { id: 2, code: 'IS-202', name: 'Ingeniería del Software' },
        dueDate: '2026-10-20',
        activityType: 'Proyecto',
        evaluationPhase: 'pilot',
        published: false,
        submissionCount: 2,
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
        submissionCount: 1,
        learningOutcomes: [],
        rubric: null,
      },
    ];
    apiMock.mockReset();
    readXlsxFileMock.mockReset();
    apiMock.mockImplementation(async (path, options = {}) => {
      if (path === '/teacher/classes' && options.method === 'POST') return { id: 3 } as never;
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

  async function mountClassDashboard(classIndex = 0) {
    const wrapper = mount(TeacherDashboard, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    });
    await flushPromises();
    await wrapper.findAll('.teacher-catalog-card')[classIndex].findAll('button')[0].trigger('click');
    return wrapper;
  }

  it('crea una clase solicitando solamente nombre, sección, código y periodo', async () => {
    const wrapper = mount(TeacherDashboard, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    });
    await flushPromises();
    await wrapper.get('.management-toolbar .button.primary').trigger('click');

    const inputs = wrapper.findAll('[aria-labelledby="create-class-title"] input');
    expect(inputs).toHaveLength(4);
    await inputs[0].setValue('Tópicos Especiales y Avanzados');
    await inputs[1].setValue('1200');
    await inputs[2].setValue('IS-901');
    await inputs[3].setValue('III PAC 2026');
    await wrapper.get('[aria-labelledby="create-class-title"] form').trigger('submit');
    await flushPromises();

    expect(apiMock).toHaveBeenCalledWith('/teacher/classes', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Tópicos Especiales y Avanzados',
        section: '1200',
        code: 'IS-901',
        period: 'III PAC 2026',
      }),
    });
  });

  it('presenta el nombre de la clase como dato principal y la sección como secundaria', async () => {
    const wrapper = mount(TeacherDashboard, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    });
    await flushPromises();

    const cards = wrapper.findAll('.teacher-catalog-card');
    expect(cards[0].get('.class-name').text()).toBe('Ingeniería del Software');
    expect(cards[0].get('.class-section').text()).toBe('Sección 1200');
    expect(cards[0].get('.class-name').element.compareDocumentPosition(
      cards[0].get('.class-section').element,
    ) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('muestra un loader y bloquea el formulario durante la matrícula individual', async () => {
    const wrapper = mount(TeacherDashboard, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    });
    await flushPromises();
    await wrapper.findAll('.teacher-catalog-card')[0].get('button').trigger('click');
    await wrapper.findAll('.enrollment-mode-tabs button')[1].trigger('click');

    let resolveEnrollment!: (value: unknown) => void;
    const pendingEnrollment = new Promise((resolve) => { resolveEnrollment = resolve; });
    apiMock.mockImplementation(async (path, options = {}) => {
      if (path === '/teacher/classes/2/enrollments' && options.method === 'POST') {
        return pendingEnrollment as never;
      }
      if (path === '/teacher/classes') return classes as never;
      if (path === '/teacher/activities' && !options.method) return currentActivities as never;
      if (path === '/teacher/rubrics') return [] as never;
      throw new Error(`Solicitud inesperada: ${path}`);
    });

    const inputs = wrapper.findAll('.individual-enrollment input');
    await inputs[0].setValue('Ana Pérez');
    await inputs[1].setValue('ana.perez@unah.edu.hn');
    await wrapper.get('.individual-enrollment').trigger('submit');
    await nextTick();

    const submitButton = wrapper.get('.individual-enrollment button');
    expect(submitButton.attributes('disabled')).toBeDefined();
    expect(submitButton.text()).toContain('Matriculando');
    expect(wrapper.get('.individual-enrollment .enrollment-loader').text()).toContain(
      'Creando o matriculando',
    );
    expect(wrapper.find('.individual-enrollment .icon-spin').exists()).toBe(true);

    resolveEnrollment({
      accountCreated: false,
      invitationEmailSent: null,
      enrollmentEmailSent: true,
    });
    await flushPromises();

    expect(wrapper.find('.individual-enrollment .enrollment-loader').exists()).toBe(false);
    expect(wrapper.text()).toContain('Estudiante matriculado');
  });

  it('muestra un loader mientras procesa la matrícula desde Excel', async () => {
    const wrapper = mount(TeacherDashboard, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    });
    await flushPromises();
    await wrapper.findAll('.teacher-catalog-card')[0].get('button').trigger('click');

    let resolveRows!: (value: unknown[][]) => void;
    const pendingRows = new Promise<unknown[][]>((resolve) => { resolveRows = resolve; });
    readXlsxFileMock.mockReturnValue(pendingRows as never);
    apiMock.mockImplementation(async (path, options = {}) => {
      if (path === '/teacher/classes/2/enrollments/bulk' && options.method === 'POST') {
        return {
          processedCount: 1,
          enrolledCount: 1,
          alreadyEnrolledCount: 0,
          createdAccountCount: 1,
          notificationFailedEmails: [],
        } as never;
      }
      if (path === '/teacher/classes') return classes as never;
      if (path === '/teacher/activities' && !options.method) return currentActivities as never;
      if (path === '/teacher/rubrics') return [] as never;
      throw new Error(`Solicitud inesperada: ${path}`);
    });

    const fileInput = wrapper.get('.excel-file-picker input');
    Object.defineProperty(fileInput.element, 'files', {
      configurable: true,
      value: [new File(['excel'], 'estudiantes.xlsx')],
    });
    await fileInput.trigger('change');
    const importButton = wrapper.get('.excel-enrollment > .button.primary');
    await importButton.trigger('click');
    await nextTick();

    expect(importButton.attributes('disabled')).toBeDefined();
    expect(importButton.text()).toContain('Procesando matrícula');
    expect(wrapper.get('.excel-enrollment .enrollment-loader').text()).toContain(
      'Validando el Excel',
    );
    expect(wrapper.find('.excel-enrollment .icon-spin').exists()).toBe(true);

    resolveRows([
      ['nombre', 'correo'],
      ['Ana Pérez', 'ana.perez@unah.edu.hn'],
    ]);
    await flushPromises();

    expect(wrapper.find('.excel-enrollment .enrollment-loader').exists()).toBe(false);
    expect(wrapper.text()).toContain('Importación de matrícula completada');
  });

  it('redirige la URL anterior de actividades al catálogo de clases', async () => {
    routeMock.query = { section: 'activities' };
    const wrapper = mount(TeacherDashboard, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    });
    await flushPromises();

    expect(wrapper.findAll('.teacher-tabs button')).toHaveLength(2);
    expect(wrapper.findAll('.teacher-tabs button')[0].classes()).toContain('active');
    expect(wrapper.findAll('.teacher-catalog-card')[0].text()).toContain('Crear actividad');
  });

  it('muestra dentro de la clase únicamente sus actividades', async () => {
    const wrapper = await mountClassDashboard();
    const dashboard = wrapper.get('.class-activities-dashboard');

    expect(dashboard.text()).toContain('Plan de pruebas');
    expect(dashboard.text()).toContain('2 entregas');
    expect(dashboard.text()).not.toContain('Aplicación con Vue');
  });

  it('crea la actividad desde su clase con rúbrica e instrucciones, sin fase', async () => {
    const availableRubric = {
      id: 7,
      name: 'Rúbrica de proyecto',
      criteria: [],
      activityId: null,
    };
    apiMock.mockImplementation(async (path, options = {}) => {
      if (path === '/teacher/classes') return classes as never;
      if (path === '/teacher/activities' && options.method === 'POST') return { id: 13 } as never;
      if (path === '/teacher/activities') return currentActivities as never;
      if (path === '/teacher/rubrics') return [availableRubric] as never;
      throw new Error(`Solicitud inesperada: ${path}`);
    });
    const wrapper = mount(TeacherDashboard, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    });
    await flushPromises();
    await wrapper.findAll('.teacher-catalog-card')[0].findAll('button')[1].trigger('click');

    const form = wrapper.get('[aria-labelledby="create-activity-title"] form');
    const inputs = form.findAll('input');
    await inputs[0].setValue('Diseño de pruebas');
    await inputs[1].setValue('2026-10-30');
    await inputs[2].setValue('Proyecto');
    await form.get('select').setValue('7');
    await form.get('textarea').setValue('Prioriza la justificación de decisiones.');

    expect(form.text()).not.toContain('Fase de evaluación');
    await form.trigger('submit');
    await flushPromises();

    expect(apiMock).toHaveBeenCalledWith('/teacher/activities', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Diseño de pruebas',
        classId: 2,
        dueDate: '2026-10-30',
        activityType: 'Proyecto',
        rubricId: 7,
        agentInstructions: 'Prioriza la justificación de decisiones.',
      }),
    });
    expect(wrapper.find('.class-activities-dashboard').exists()).toBe(true);
  });

  it('confirma la eliminación, llama la API y retira la actividad de la clase', async () => {
    const wrapper = await mountClassDashboard(1);
    const configureButton = wrapper.get('.class-activities-dashboard')
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
    expect(wrapper.get('.class-activities-dashboard').text()).not.toContain('Aplicación con Vue');
  });
});
