// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '../api';
import AdminAiSettings from './AdminAiSettings.vue';

vi.mock('../api', async (importOriginal) => ({ ...await importOriginal<typeof import('../api')>(), api: vi.fn() }));
const apiMock = vi.mocked(api);
const stageInstructions = { aiUsage: 'Estima el uso de IA con evidencia.', suggestedGrade: 'Valora la rúbrica.', feedback: 'Explica aciertos y mejoras.', understanding: 'Evalúa la comprensión.', indicators: 'Considera pensamiento crítico, autonomía y autenticidad.' };
const settings = { model: 'default', instructions: 'Evalúa con evidencia.', stageInstructions, effectiveModel: 'server-model', enabled: true, providerConfigured: true, apiKeyConfigured: true, apiKeySource: 'server', vercelSyncConfigured: true };
const wrappers: VueWrapper[] = [];

function mountSettings() {
  const wrapper = mount(AdminAiSettings);
  wrappers.push(wrapper);
  return wrapper;
}

function deferred<T = unknown>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const successfulKeyUpdate = {
  ...settings,
  apiKeySource: 'admin',
  vercelSync: { status: 'redeploy_requested', message: 'API key actualizada en Vercel. Despliegue solicitado.' },
};

describe('AdminAiSettings', () => {
  beforeEach(() => {
    apiMock.mockReset();
    apiMock.mockResolvedValue(settings);
  });

  afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows initial loading and lets the user recover from a failed load', async () => {
    const pending = deferred();
    apiMock.mockReturnValue(pending.promise);
    const wrapper = mountSettings();
    expect(wrapper.get('[role="status"]').text()).toContain('Cargando configuración');
    expect(wrapper.find('[role="status"] .icon-spin').exists()).toBe(true);
    expect(wrapper.find('.ai-key-form').exists()).toBe(false);
    pending.reject(new Error('Internal infrastructure error'));
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('No se pudo cargar la configuración');
    expect(wrapper.text()).not.toContain('Internal infrastructure error');
    apiMock.mockResolvedValue(settings);
    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(apiMock).toHaveBeenCalledTimes(2);
    expect(wrapper.find('.ai-key-form').exists()).toBe(true);
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it('loads the saved policy and applies edits only when saved', async () => {
    const wrapper = mountSettings();
    await flushPromises();
    expect((wrapper.get('#instructions-aiUsage').element as HTMLTextAreaElement).value).toBe(stageInstructions.aiUsage);
    expect(wrapper.findAll('fieldset')).toHaveLength(5);
    const updated = 'Comprueba las fuentes antes de estimar el uso de IA.';
    await wrapper.get('#instructions-aiUsage').setValue(updated);
    expect(apiMock).toHaveBeenCalledTimes(1);
    const changed = { ...stageInstructions, aiUsage: updated };
    const pending = deferred();
    apiMock.mockReturnValue(pending.promise);
    await wrapper.get('.ai-instructions-form').trigger('submit');
    expect(wrapper.get('.ai-instructions-form').attributes('aria-busy')).toBe('true');
    expect(wrapper.find('.ai-instructions-form button[type="submit"] .icon-spin').exists()).toBe(true);
    expect(wrapper.get('.ai-instructions-form button[type="submit"]').text()).toContain('Guardando instrucciones');
    expect(wrapper.get('#ai-api-key').attributes('disabled')).toBeDefined();
    await wrapper.get('.ai-instructions-form').trigger('submit');
    expect(apiMock).toHaveBeenCalledTimes(2);
    pending.resolve({ ...settings, stageInstructions: changed });
    await flushPromises();
    expect(apiMock).toHaveBeenLastCalledWith('/admin/ai-engine/instructions', { method: 'PUT', body: JSON.stringify({ model: 'default', enabled: true, instructions: settings.instructions, stageInstructions: changed }) });
    expect(wrapper.text()).toContain('Instrucciones guardadas correctamente');
    expect(wrapper.get('.ai-instructions-form').attributes('aria-busy')).toBe('false');
    expect(wrapper.find('.ai-instructions-form .icon-spin').exists()).toBe(false);
    expect((wrapper.get('#instructions-feedback').element as HTMLTextAreaElement).value).toBe(stageInstructions.feedback);
  });

  it('keeps unsaved text and reports server validation failures', async () => {
    const wrapper = mountSettings();
    await flushPromises();
    await wrapper.get('#instructions-understanding').setValue('Explica los vacíos de comprensión.');
    apiMock.mockRejectedValue(new Error('No se pudo guardar'));
    await wrapper.get('.ai-instructions-form').trigger('submit');
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('No se pudieron guardar las instrucciones');
    expect(wrapper.get('.ai-instructions-form button[type="submit"]').attributes('disabled')).toBeUndefined();
    expect((wrapper.get('#instructions-understanding').element as HTMLTextAreaElement).value).toBe('Explica los vacíos de comprensión.');
  });

  it('imports plain text only into its selected point without saving automatically', async () => {
    const wrapper = mountSettings();
    await flushPromises();
    const input = wrapper.get('[data-stage="indicators"] input[type="file"]');
    const imported = 'Busca decisiones propias y contraste de fuentes.';
    const pending = deferred<string>();
    Object.defineProperty(input.element, 'files', { value: [{ name: 'indicadores.txt', size: imported.length, text: () => pending.promise }] });
    await input.trigger('change');
    expect(wrapper.get('[data-stage="indicators"]').attributes('aria-busy')).toBe('true');
    expect(wrapper.find('[data-stage="indicators"] [role="status"] .icon-spin').exists()).toBe(true);
    expect(wrapper.get('.ai-instructions-form button[type="submit"]').attributes('disabled')).toBeDefined();
    pending.resolve(imported);
    await flushPromises();
    expect((wrapper.get('#instructions-indicators').element as HTMLTextAreaElement).value).toBe(imported);
    expect((wrapper.get('#instructions-aiUsage').element as HTMLTextAreaElement).value).toBe(stageInstructions.aiUsage);
    expect(apiMock).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('Guarda para aplicar');
    expect(wrapper.find('[data-stage="indicators"] .icon-spin').exists()).toBe(false);
  });

  it('rejects non-text files without replacing the instructions', async () => {
    const wrapper = mountSettings();
    await flushPromises();
    const input = wrapper.get('[data-stage="feedback"] input[type="file"]');
    Object.defineProperty(input.element, 'files', { value: [{ name: 'archivo.pdf', size: 10 }] });
    await input.trigger('change');
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('.txt');
    expect((wrapper.get('#instructions-feedback').element as HTMLTextAreaElement).value).toBe(stageInstructions.feedback);
  });

  it('preserves the current instructions and clears loading when a file cannot be read', async () => {
    const wrapper = mountSettings();
    await flushPromises();
    const input = wrapper.get('[data-stage="feedback"] input[type="file"]');
    Object.defineProperty(input.element, 'files', { value: [{ name: 'comentarios.txt', size: 10, text: () => Promise.reject(new Error('File handle closed')) }] });
    await input.trigger('change');
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('No se pudo leer el archivo');
    expect(wrapper.text()).not.toContain('File handle closed');
    expect(wrapper.get('[data-stage="feedback"]').attributes('aria-busy')).toBe('false');
    expect(wrapper.get('[data-stage="feedback"]').attributes('disabled')).toBeUndefined();
    expect((wrapper.get('#instructions-feedback').element as HTMLTextAreaElement).value).toBe(stageInstructions.feedback);
  });

  it('saves the new key separately, clears it, and preserves unsaved instructions', async () => {
    const wrapper = mountSettings();
    await flushPromises();
    await wrapper.get('#instructions-feedback').setValue('Cambio aún sin guardar.');
    expect(wrapper.get('#ai-api-key').attributes('type')).toBe('password');
    await wrapper.get('#ai-api-key').setValue('test-only-admin-panel-key');
    const pending = deferred();
    apiMock.mockReturnValue(pending.promise);
    await wrapper.get('.ai-key-form').trigger('submit');
    expect(wrapper.get('.ai-key-form').attributes('aria-busy')).toBe('true');
    expect(wrapper.find('.ai-key-form button[type="submit"] .icon-spin').exists()).toBe(true);
    expect(wrapper.get('.ai-key-form button[type="submit"]').text()).toContain('Verificando y guardando');
    expect(wrapper.get('[data-stage="feedback"]').attributes('disabled')).toBeDefined();
    await wrapper.get('.ai-key-form').trigger('submit');
    expect(apiMock).toHaveBeenCalledTimes(2);
    pending.resolve(successfulKeyUpdate);
    await flushPromises();
    expect(apiMock).toHaveBeenLastCalledWith('/admin/ai-engine/api-key', { method: 'PUT', body: JSON.stringify({ apiKey: 'test-only-admin-panel-key' }) });
    expect((wrapper.get('#ai-api-key').element as HTMLInputElement).value).toBe('');
    expect(wrapper.text()).not.toContain('test-only-admin-panel-key');
    expect(wrapper.text()).toContain('API key guardada correctamente');
    expect(wrapper.text()).not.toContain('Vercel');
    expect(wrapper.text()).not.toContain('Despliegue');
    expect(wrapper.find('.ai-key-error').exists()).toBe(false);
    expect(wrapper.get('.ai-key-form').attributes('aria-busy')).toBe('false');
    expect((wrapper.get('#instructions-feedback').element as HTMLTextAreaElement).value).toBe('Cambio aún sin guardar.');
  });

  it('reports a failed key update without changing its configured source', async () => {
    const wrapper = mountSettings();
    await flushPromises();
    await wrapper.get('#ai-api-key').setValue('test-only-admin-panel-key');
    apiMock.mockRejectedValue(new Error('Vercel upstream failure'));
    await wrapper.get('.ai-key-form').trigger('submit');
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('No se pudo completar el guardado');
    expect(wrapper.text()).toContain('Configurada en el servidor');
    expect(wrapper.text()).not.toContain('Vercel');
    expect((wrapper.get('#ai-api-key').element as HTMLInputElement).value).toBe('test-only-admin-panel-key');
    expect(wrapper.get('.ai-key-form').attributes('aria-busy')).toBe('false');
  });

  it.each(['cualquiercosa', 'a'.repeat(19), 'a'.repeat(20) + ' space', 'é'.repeat(30)])('rejects malformed keys locally without changing the current key', async (value) => {
    const wrapper = mountSettings();
    await flushPromises();
    await wrapper.get('#ai-api-key').setValue(value);
    await wrapper.get('.ai-key-form').trigger('submit');
    expect(apiMock).toHaveBeenCalledTimes(1);
    expect(wrapper.get('[role="alert"]').text()).toContain('entre 20 y 4096 caracteres');
    expect(wrapper.text()).toContain('Configurada en el servidor');
    expect(wrapper.get('.ai-key-form').attributes('aria-busy')).toBe('false');
  });

  it.each([
    'La API key no es válida o fue revocada. Revisa la clave e inténtalo de nuevo.',
    'La API key no tiene permiso para usar el motor de IA. Revisa sus permisos y restricciones.',
  ])('shows the provider validation failure while preserving the current key and entered value', async (message) => {
    const wrapper = mountSettings();
    await flushPromises();
    await wrapper.get('#ai-api-key').setValue('test-only-admin-panel-key');
    apiMock.mockRejectedValue(new ApiError(message, 400));
    await wrapper.get('.ai-key-form').trigger('submit');
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain(message);
    expect(wrapper.get('[role="alert"]').text()).toContain('No se cambió la clave actual');
    expect(wrapper.text()).toContain('Configurada en el servidor');
    expect(wrapper.find('.ai-key-error button').exists()).toBe(false);
    expect((wrapper.get('#ai-api-key').element as HTMLInputElement).value).toBe('test-only-admin-panel-key');
    expect(wrapper.get('.ai-key-form').attributes('aria-busy')).toBe('false');
    expect(wrapper.find('.ai-key-form .icon-spin').exists()).toBe(false);
  });

  it('reports unavailable verification without showing infrastructure details or success', async () => {
    const wrapper = mountSettings();
    await flushPromises();
    await wrapper.get('#ai-api-key').setValue('test-only-admin-panel-key');
    apiMock.mockRejectedValue(new ApiError('Internal provider configuration failure', 503));
    await wrapper.get('.ai-key-form').trigger('submit');
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('No se pudo verificar la API key');
    expect(wrapper.get('[role="alert"]').text()).toContain('No se cambió la clave actual');
    expect(wrapper.text()).not.toContain('Internal provider configuration failure');
    expect(wrapper.text()).not.toContain('API key guardada correctamente');
    expect(wrapper.text()).toContain('Configurada en el servidor');
    expect(wrapper.find('.ai-key-form .icon-spin').exists()).toBe(false);
  });

  it.each(['env_update_failed', 'redeploy_failed'])('only offers retry after %s and never resends a secret from the browser', async (status) => {
    const wrapper = mountSettings();
    await flushPromises();
    expect(wrapper.text()).not.toContain('Reintentar actualización');
    await wrapper.get('#ai-api-key').setValue('test-only-admin-panel-key');
    apiMock.mockResolvedValue({ ...settings, apiKeySource: 'admin', vercelSync: { status, message: 'Detalle técnico de Vercel.' } });
    await wrapper.get('.ai-key-form').trigger('submit');
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('La clave se guardó, pero la actualización automática quedó pendiente');
    expect(wrapper.text()).not.toContain('Vercel');
    expect((wrapper.get('#ai-api-key').element as HTMLInputElement).value).toBe('');
    const pending = deferred();
    apiMock.mockReturnValue(pending.promise);
    const button = wrapper.get('.ai-key-error button');
    await button.trigger('click');
    expect(button.text()).toContain('Actualizando');
    expect(button.find('.icon-spin').exists()).toBe(true);
    expect(button.attributes('disabled')).toBeDefined();
    expect(wrapper.get('.ai-key-form button[type="submit"]').text()).toBe('Guardar API key');
    await button.trigger('click');
    expect(apiMock).toHaveBeenCalledTimes(3);
    pending.resolve(successfulKeyUpdate);
    await flushPromises();
    expect(apiMock).toHaveBeenLastCalledWith('/admin/ai-engine/api-key/sync', { method: 'POST' });
    expect(wrapper.text()).toContain('API key guardada correctamente');
    expect(wrapper.find('.ai-key-error').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('Reintentar actualización');
  });

  it('keeps retry available and clears its loader when the retry request fails', async () => {
    const wrapper = mountSettings();
    await flushPromises();
    await wrapper.get('#ai-api-key').setValue('test-only-admin-panel-key');
    apiMock.mockResolvedValue({ ...settings, apiKeySource: 'admin', vercelSync: { status: 'env_update_failed', message: 'Vercel failure' } });
    await wrapper.get('.ai-key-form').trigger('submit');
    await flushPromises();
    apiMock.mockRejectedValue(new Error('Vercel failure'));
    await wrapper.get('.ai-key-error button').trigger('click');
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('No se pudo completar la actualización automática');
    expect(wrapper.text()).not.toContain('Vercel');
    expect(wrapper.get('.ai-key-error button').attributes('disabled')).toBeUndefined();
    expect(wrapper.find('.ai-key-error .icon-spin').exists()).toBe(false);
  });

  it('explains that automatic updates are unavailable without offering an unusable retry', async () => {
    apiMock.mockResolvedValue({ ...settings, vercelSyncConfigured: false });
    const wrapper = mountSettings();
    await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    await wrapper.get('#ai-api-key').setValue('test-only-admin-panel-key');
    apiMock.mockResolvedValue({ ...settings, apiKeySource: 'admin', vercelSyncConfigured: false, vercelSync: { status: 'not_configured', message: 'Configurar Vercel' } });
    await wrapper.get('.ai-key-form').trigger('submit');
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('La clave se guardó, pero la actualización automática no está disponible');
    expect(wrapper.text()).not.toContain('Vercel');
    expect(wrapper.find('.ai-key-error button').exists()).toBe(false);
  });

  it('briefly confirms success without leaving a permanent technical message', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const wrapper = mountSettings();
    await flushPromises();
    await wrapper.get('#ai-api-key').setValue('test-only-admin-panel-key');
    apiMock.mockResolvedValue(successfulKeyUpdate);
    await wrapper.get('.ai-key-form').trigger('submit');
    await flushPromises();
    expect(wrapper.get('.ai-key-form [role="status"]').text()).toBe('API key guardada correctamente.');
    vi.advanceTimersByTime(4_000);
    await flushPromises();
    expect(wrapper.find('.ai-key-form [role="status"]').exists()).toBe(false);
  });
});
