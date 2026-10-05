// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import AdminAiSettings from './AdminAiSettings.vue';

vi.mock('../api', () => ({ api: vi.fn() }));
const apiMock = vi.mocked(api);
const markdown = '---\nmodel: default\nenabled: true\n---\nEvalúa con evidencia.';
const settings = { markdown, effectiveModel: 'server-model', enabled: true, providerConfigured: true };

describe('AdminAiSettings', () => {
  beforeEach(() => {
    apiMock.mockReset();
    apiMock.mockResolvedValue(settings);
  });

  it('loads the saved policy and applies edits only when saved', async () => {
    const wrapper = mount(AdminAiSettings);
    await flushPromises();
    expect(wrapper.text()).toContain('server-model');
    const updated = markdown.replace('default', 'provider/model');
    await wrapper.get('textarea').setValue(updated);
    expect(apiMock).toHaveBeenCalledTimes(1);
    apiMock.mockResolvedValue({ ...settings, markdown: updated, effectiveModel: 'provider/model' });
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(apiMock).toHaveBeenLastCalledWith('/admin/ai-engine', { method: 'PUT', body: JSON.stringify({ markdown: updated }) });
    expect(wrapper.text()).toContain('Configuración guardada');
    expect(wrapper.text()).toContain('provider/model');
  });

  it('keeps unsaved text and reports server validation failures', async () => {
    const wrapper = mount(AdminAiSettings);
    await flushPromises();
    await wrapper.get('textarea').setValue('# Archivo incompleto');
    apiMock.mockRejectedValue(new Error('El archivo debe iniciar con un bloque ---'));
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('bloque ---');
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('# Archivo incompleto');
    expect(wrapper.text()).toContain('server-model');
  });

  it('imports a Markdown file without saving automatically', async () => {
    const wrapper = mount(AdminAiSettings);
    await flushPromises();
    const input = wrapper.get('input[type="file"]');
    const imported = markdown.replace('true', 'false');
    Object.defineProperty(input.element, 'files', { value: [{ name: 'config.md', size: imported.length, text: async () => imported }] });
    await input.trigger('change');
    await flushPromises();
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe(imported);
    expect(apiMock).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('Guarda para aplicar');
  });
});
