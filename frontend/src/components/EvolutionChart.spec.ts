// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EvolutionChart from './EvolutionChart.vue';

const { apiMock } = vi.hoisted(() => ({ apiMock: vi.fn() }));

vi.mock('../api', () => ({ api: apiMock }));
vi.mock('chart.js', () => ({
  Chart: { register: vi.fn() },
  CategoryScale: {},
  LinearScale: {},
  PointElement: {},
  LineElement: {},
  Title: {},
  Tooltip: {},
  Legend: {},
  Filler: {},
}));
vi.mock('vue-chartjs', () => ({
  Line: {
    name: 'Line',
    props: ['data', 'options'],
    template: '<div class="line-chart" />',
  },
}));

const response = {
  labels: ['2026-03-10', '2026-04-20', '2026-05-15'],
  myGrades: [0, 33, null],
  classAverage: [34, 67, null],
  trendLine: [0, 33, null],
  activities: [
    {
      id: 1,
      title: 'Actividad inicial',
      dueDate: '2026-03-10',
      submittedAt: '2026-03-08T14:00:00.000Z',
    },
    {
      id: 2,
      title: 'Actividad posterior',
      dueDate: '2026-04-20',
      submittedAt: '2026-04-19T16:30:00.000Z',
    },
    {
      id: 3,
      title: 'Actividad pendiente',
      dueDate: '2026-05-15',
      submittedAt: '2026-05-14T12:00:00.000Z',
    },
  ],
};

const classes = [
  { id: 12, name: 'Ingeniería de Software', code: 'IS-12' },
  { id: 18, name: 'Bases de Datos', code: 'BD-18' },
];

describe('EvolutionChart - HU-33', () => {
  beforeEach(() => {
    apiMock.mockReset().mockResolvedValue(structuredClone(response));
  });

  it('configura notas, promedio, tendencia y tooltip con la fecha real de entrega', async () => {
    const wrapper = mount(EvolutionChart, { props: { classes } });
    await flushPromises();

    expect(apiMock).toHaveBeenCalledWith('/student/performance-chart');
    const chart = wrapper.findComponent({ name: 'Line' });
    expect(chart.exists()).toBe(true);

    const data = chart.props('data') as {
      labels: Array<[string, string]>;
      datasets: Array<{
        label: string;
        data: Array<number | null>;
        fill: boolean;
        borderDash?: number[];
      }>;
    };
    expect(data.labels[0]).toEqual(['2026-03-10', 'Actividad inicial']);
    expect(data.datasets[0]).toMatchObject({
      label: 'Mi nota (%)',
      data: [0, 33, null],
      fill: false,
    });
    expect(data.datasets[1]).toMatchObject({
      label: 'Promedio clase (%)',
      data: [34, 67, null],
      fill: true,
    });
    expect(data.datasets[2]).toMatchObject({
      label: 'Tendencia',
      data: [0, 33, null],
      borderDash: [6, 4],
    });

    const options = chart.props('options') as {
      plugins: {
        tooltip: {
          callbacks: {
            title: (items: Array<{ dataIndex: number }>) => string;
            label: (item: {
              parsed: { y: number | null };
              dataset: { label: string };
            }) => string;
          };
        };
      };
      scales: { y: { min: number; max: number } };
    };
    expect(options.scales.y).toMatchObject({ min: 0, max: 100 });
    expect(options.plugins.tooltip.callbacks.title([{ dataIndex: 0 }])).toBe(
      'Actividad inicial · Entrega: 2026-03-08',
    );
    expect(options.plugins.tooltip.callbacks.label({
      parsed: { y: 33 },
      dataset: { label: 'Mi nota (%)' },
    })).toBe('Mi nota (%): 33%');
  });

  it('permite filtrar una clase y regresar a todas las clases', async () => {
    const wrapper = mount(EvolutionChart, { props: { classes } });
    await flushPromises();

    const selector = wrapper.get('.evolution-selector select');
    expect(selector.findAll('option')).toHaveLength(3);
    await selector.setValue('12');
    await flushPromises();
    expect(apiMock).toHaveBeenCalledWith('/student/performance-chart?classId=12');

    await selector.setValue('all');
    await flushPromises();
    expect(apiMock.mock.calls.filter(([path]) => path === '/student/performance-chart')).toHaveLength(2);
  });

  it('muestra el estado vacío cuando no existen calificaciones publicadas', async () => {
    apiMock.mockResolvedValue({
      labels: ['2026-05-15'],
      myGrades: [null],
      classAverage: [null],
      trendLine: [null],
      activities: [{
        id: 3,
        title: 'Actividad pendiente',
        dueDate: '2026-05-15',
        submittedAt: null,
      }],
    });

    const wrapper = mount(EvolutionChart, { props: { classes: [classes[0]] } });
    await flushPromises();

    expect(wrapper.findComponent({ name: 'Line' }).exists()).toBe(false);
    expect(wrapper.get('.evolution-empty').text()).toContain('Sin calificaciones todavía');
    expect(wrapper.find('.evolution-selector').exists()).toBe(true);
  });
});
