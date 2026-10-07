// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import AdminAiSettings from './AdminAiSettings.vue';

vi.mock('../api', () => ({ api: vi.fn() }));
const apiMock = vi.mocked(api);
const stageInstructions = { aiUsage: 'Estima el uso de IA con evidencia.', suggestedGrade: 'Valora la rúbrica.', feedback: 'Explica aciertos y mejoras.', understanding: 'Evalúa la comprensión.', indicators: 'Considera pensamiento crítico, autonomía y autenticidad.' };
const settings = { model: 'default', instructions: 'Evalúa con evidencia.', stageInstructions, effectiveModel: 'server-model', enabled: true, providerConfigured: true, apiKeyConfigured: true, apiKeySource: 'server', vercelSyncConfigured: true };

describe('AdminAiSettings', () => {
  beforeEach(() => {
    apiMock.mockReset();
    apiMock.mockResolvedValue(settings);
  });

  it('loads the saved policy and applies edits only when saved', async () => {
    const wrapper = mount(AdminAiSettings);
    await flushPromises();
    expect((wrapper.get('#instructions-aiUsage').element as HTMLTextAreaElement).value).toBe(stageInstructions.aiUsage);
    expect(wrapper.findAll('fieldset')).toHaveLength(5);
    const updated = 'Comprueba las fuentes antes de estimar el uso de IA.';
    await wrapper.get('#instructions-aiUsage').setValue(updated);
    expect(apiMock).toHaveBeenCalledTimes(1);
    const changed = { ...stageInstructions, aiUsage: updated };
    apiMock.mockResolvedValue({ ...settings, stageInstructions: changed });
    await wrapper.get('.ai-instructions-form').trigger('submit');
    await flushPromises();
    expect(apiMock).toHaveBeenLastCalledWith('/admin/ai-engine/instructions', { method: 'PUT', body: JSON.stringify({ model: 'default', enabled: true, instructions: settings.instructions, stageInstructions: changed }) });
    expect(wrapper.text()).toContain('Comportamiento de los cinco puntos guardado');
    expect((wrapper.get('#instructions-feedback').element as HTMLTextAreaElement).value).toBe(stageInstructions.feedback);
  });

  it('keeps unsaved text and reports server validation failures', async () => {
    const wrapper = mount(AdminAiSettings);
    await flushPromises();
    await wrapper.get('#instructions-understanding').setValue('Explica los vacíos de comprensión.');
    apiMock.mockRejectedValue(new Error('No se pudo guardar'));
    await wrapper.get('.ai-instructions-form').trigger('submit');
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('No se pudo guardar');
    expect((wrapper.get('#instructions-understanding').element as HTMLTextAreaElement).value).toBe('Explica los vacíos de comprensión.');
  });

  it('imports plain text only into its selected point without saving automatically', async () => {
    const wrapper = mount(AdminAiSettings);
    await flushPromises();
    const input = wrapper.get('[data-stage="indicators"] input[type="file"]');
    const imported = 'Busca decisiones propias y contraste de fuentes.';
    Object.defineProperty(input.element, 'files', { value: [{ name: 'indicadores.txt', size: imported.length, text: async () => imported }] });
    await input.trigger('change');
    await flushPromises();
    expect((wrapper.get('#instructions-indicators').element as HTMLTextAreaElement).value).toBe(imported);
    expect((wrapper.get('#instructions-aiUsage').element as HTMLTextAreaElement).value).toBe(stageInstructions.aiUsage);
    expect(apiMock).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('Guarda para aplicar');
  });

  it('rejects non-text files without replacing the instructions', async () => {
    const wrapper = mount(AdminAiSettings);
    await flushPromises();
    const input = wrapper.get('[data-stage="feedback"] input[type="file"]');
    Object.defineProperty(input.element, 'files', { value: [{ name: 'archivo.pdf', size: 10 }] });
    await input.trigger('change');
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('.txt');
    expect((wrapper.get('#instructions-feedback').element as HTMLTextAreaElement).value).toBe(stageInstructions.feedback);
  });

  it('saves the new key separately, clears it, and preserves unsaved instructions', async () => {
    const wrapper = mount(AdminAiSettings);
    await flushPromises();
    await wrapper.get('#instructions-feedback').setValue('Cambio aún sin guardar.');
    expect(wrapper.get('#ai-api-key').attributes('type')).toBe('password');
    await wrapper.get('#ai-api-key').setValue('test-only-panel-key');
    apiMock.mockResolvedValue({ ...settings, apiKeySource: 'admin', vercelSync: { status: 'redeploy_requested', message: 'API key actualizada en Vercel. Despliegue solicitado.' } });
    await wrapper.get('.ai-key-form').trigger('submit');
    await flushPromises();
    expect(apiMock).toHaveBeenLastCalledWith('/admin/ai-engine/api-key', { method: 'PUT', body: JSON.stringify({ apiKey: 'test-only-panel-key' }) });
    expect((wrapper.get('#ai-api-key').element as HTMLInputElement).value).toBe('');
    expect(wrapper.text()).not.toContain('test-only-panel-key');
    expect(wrapper.text()).toContain('API key actualizada');
    expect((wrapper.get('#instructions-feedback').element as HTMLTextAreaElement).value).toBe('Cambio aún sin guardar.');
  });

  it('reports a failed key update without changing its configured source', async () => {
    const wrapper = mount(AdminAiSettings);
    await flushPromises();
    await wrapper.get('#ai-api-key').setValue('test-only-panel-key');
    apiMock.mockRejectedValue(new Error('No se pudo guardar la API key'));
    await wrapper.get('.ai-key-form').trigger('submit');
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('No se pudo guardar');
    expect(wrapper.text()).toContain('Configurada en el servidor');
  });

  it('restores the server key without submitting a new secret', async () => {
    apiMock.mockResolvedValue({ ...settings, apiKeySource: 'admin' });
    const wrapper = mount(AdminAiSettings);
    await flushPromises();
    apiMock.mockResolvedValue(settings);
    await wrapper.findAll('.ai-key-form button[type="button"]').find((button) => button.text() === 'Usar clave del servidor')!.trigger('click');
    await flushPromises();
    expect(apiMock).toHaveBeenLastCalledWith('/admin/ai-engine/api-key', { method: 'DELETE' });
    expect(wrapper.text()).toContain('Configurada en el servidor');
  });

  it('reports incomplete synchronization and retries without resending a secret from the browser', async () => {
    const wrapper = mount(AdminAiSettings);
    await flushPromises();
    await wrapper.get('#ai-api-key').setValue('test-only-panel-key');
    apiMock.mockResolvedValue({ ...settings, apiKeySource: 'admin', vercelSync: { status: 'redeploy_failed', message: 'Variable actualizada. No se pudo solicitar el despliegue.' } });
    await wrapper.get('.ai-key-form').trigger('submit');
    await flushPromises();
    expect(wrapper.text()).toContain('No se pudo solicitar el despliegue');
    expect((wrapper.get('#ai-api-key').element as HTMLInputElement).value).toBe('');
    apiMock.mockResolvedValue({ ...settings, apiKeySource: 'admin', vercelSync: { status: 'redeploy_requested', message: 'Despliegue solicitado automáticamente.' } });
    await wrapper.findAll('.ai-key-form button[type="button"]').find((button) => button.text().includes('Reintentar sincronización'))!.trigger('click');
    await flushPromises();
    expect(apiMock).toHaveBeenLastCalledWith('/admin/ai-engine/api-key/sync', { method: 'POST' });
    expect(wrapper.text()).toContain('Despliegue solicitado automáticamente');
    expect(wrapper.text()).not.toContain('No se pudo solicitar el despliegue');
  });
});
