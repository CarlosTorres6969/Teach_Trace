// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import StudentResultsView from './StudentResultsView.vue';

vi.mock('../api', () => ({ api: vi.fn() }));
vi.mock('vue-router', () => ({ useRoute: () => ({ params: { id: '12' } }) }));

describe('Nota publicada del estudiante', () => {
  it.each([0, 90.48])('muestra la nota final %s%% y conserva el promedio de la rúbrica como referencia', async (gradePercentage) => {
    vi.mocked(api).mockResolvedValue({
      activity: { id: 12, title: 'Actividad' }, status: 'evaluated', valuations: [],
      gradePercentage, finalScore: 3, feedback: 'Retroalimentación publicada',
    });
    const wrapper = mount(StudentResultsView, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    });
    await flushPromises();
    expect(wrapper.text()).toContain('Nota publicada');
    expect(wrapper.findAll('.results-score-value')[0].text()).toBe(`${gradePercentage}%`);
    expect(wrapper.findAll('.results-score-value')[1].text()).toBe('3.00');
    wrapper.unmount();
  });
});
