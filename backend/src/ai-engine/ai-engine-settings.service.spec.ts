import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { AiEngineSettings } from '../entities/ai-engine-settings.entity';
import { AiEngineSettingsService, DEFAULT_AI_MARKDOWN, parseAiMarkdown } from './ai-engine-settings.service';
import { DEFAULT_STAGE_INSTRUCTIONS } from './ai-stage-instructions';

describe('AiEngineSettingsService', () => {
  const repository = { findOneBy: jest.fn(), create: jest.fn((value) => value), save: jest.fn() };
  const config = new ConfigService({ AI_MODEL: 'server-model', AI_API_URL: 'https://example.test', AI_API_KEY: 'secret' });
  const service = new AiEngineSettingsService(repository as unknown as Repository<AiEngineSettings>, config);

  beforeEach(() => jest.clearAllMocks());

  it('uses the server model before an administrator saves a configuration', async () => {
    repository.findOneBy.mockResolvedValue(null);
    expect(await service.getSettings()).toMatchObject({ markdown: DEFAULT_AI_MARKDOWN, effectiveModel: 'server-model', enabled: true, stageInstructions: DEFAULT_STAGE_INSTRUCTIONS });
  });

  it('persists a selected model and disabled analysis', async () => {
    const markdown = '---\nmodel: provider/custom-model\nenabled: false\n---\n# Evaluación\nComprueba las fuentes.';
    repository.findOneBy.mockResolvedValue({ id: 1, markdown });
    expect(await service.saveSettings(markdown)).toMatchObject({ effectiveModel: 'provider/custom-model', enabled: false, instructions: '# Evaluación\nComprueba las fuentes.' });
    expect(repository.save).toHaveBeenCalledWith({ id: 1, markdown });
  });

  it.each([
    '# Sin configuración',
    '---\nmodel: a\nenabled: yes\n---\nTexto',
    '---\nmodel: a\nmodel: b\nenabled: true\n---\nTexto',
    '---\nmodel: a\nenabled: true\napiKey: secret\n---\nTexto',
    '---\nmodel: a\nenabled: true\n---\n',
    'x'.repeat(20_001),
  ])('rejects malformed files before saving', async (markdown) => {
    await expect(service.saveSettings(markdown)).rejects.toThrow();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('accepts Windows line endings and UTF-8 BOM', () => {
    expect(parseAiMarkdown('\uFEFF---\r\nmodel: default\r\nenabled: true\r\n---\r\nInstrucciones')).toEqual({ model: 'default', enabled: true, instructions: 'Instrucciones' });
  });

  it('preserves legacy general instructions and provides defaults for the five points', async () => {
    repository.findOneBy.mockResolvedValue({ id: 1, markdown: '---\nmodel: default\nenabled: true\n---\nReglas anteriores.' });
    expect(await service.getSettings()).toMatchObject({ instructions: 'Reglas anteriores.', stageInstructions: DEFAULT_STAGE_INSTRUCTIONS });
  });

  it('persists and reloads separate plain text instructions', async () => {
    const stageInstructions = { ...DEFAULT_STAGE_INSTRUCTIONS, feedback: 'Explica las mejoras con ejemplos.' };
    repository.findOneBy.mockResolvedValue({ id: 1, markdown: '---\nmodel: custom-model\nenabled: true\n---\nReglas generales.', stageInstructions });
    const result = await service.saveStageSettings({ model: 'custom-model', enabled: true, instructions: 'Reglas generales.', stageInstructions });
    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ id: 1, stageInstructions }));
    expect(result).toMatchObject({ effectiveModel: 'custom-model', stageInstructions });
  });

  it.each(['', '   ', 'x'.repeat(5001)])('rejects an empty or oversized point before persisting', async (feedback) => {
    await expect(service.saveStageSettings({ model: 'default', enabled: true, instructions: 'Reglas.', stageInstructions: { ...DEFAULT_STAGE_INSTRUCTIONS, feedback } })).rejects.toThrow();
    expect(repository.save).not.toHaveBeenCalled();
  });
});

describe('AI API key storage', () => {
  const jwtSecret = 'test-only-secret-with-more-than-32-characters';
  const newKey = 'test-only-admin-provider-key';
  let row: AiEngineSettings | null;
  const repository = {
    findOneBy: jest.fn(async () => row),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => { row = { ...row, ...value }; return row; }),
  };
  const config = new ConfigService({ AI_API_KEY: 'test-only-server-key', AI_API_URL: 'https://example.test', JWT_SECRET: jwtSecret, AI_SETTINGS_ENCRYPTION_KEY: '' });
  const service = new AiEngineSettingsService(repository as unknown as Repository<AiEngineSettings>, config);

  beforeEach(() => { row = null; jest.clearAllMocks(); });

  it('encrypts the key and only decrypts it for the engine across service instances', async () => {
    const result = await service.saveApiKey(newKey);
    expect(result).toMatchObject({ apiKeyConfigured: true, apiKeySource: 'admin', providerConfigured: true });
    expect(JSON.stringify(result)).not.toContain(newKey);
    expect(result).not.toHaveProperty('apiKey');
    expect(result).not.toHaveProperty('encryptedApiKey');
    expect(row!.encryptedApiKey).toMatch(/^v1\./);
    expect(row!.encryptedApiKey).not.toContain(newKey);
    const nextInstance = new AiEngineSettingsService(repository as unknown as Repository<AiEngineSettings>, config);
    expect((await nextInstance.getRuntimeSettings()).apiKey).toBe(newKey);
    const previousCiphertext = row!.encryptedApiKey;
    await nextInstance.saveApiKey(newKey);
    expect(row!.encryptedApiKey).not.toBe(previousCiphertext);
  });

  it('rotates the key without altering instructions and can restore the server key', async () => {
    row = { id: 1, markdown: DEFAULT_AI_MARKDOWN, stageInstructions: DEFAULT_STAGE_INSTRUCTIONS, encryptedApiKey: null };
    await service.saveApiKey(newKey);
    await service.saveApiKey('test-only-replacement-key');
    expect((await service.getRuntimeSettings()).apiKey).toBe('test-only-replacement-key');
    expect(row.stageInstructions).toEqual(DEFAULT_STAGE_INSTRUCTIONS);
    expect(row.markdown).toBe(DEFAULT_AI_MARKDOWN);
    expect(await service.restoreServerApiKey()).toMatchObject({ apiKeySource: 'server' });
    expect((await service.getRuntimeSettings()).apiKey).toBe('test-only-server-key');
    expect(row.encryptedApiKey).toBeNull();
  });

  it('preserves the saved key when the administrator changes instructions', async () => {
    await service.saveApiKey(newKey);
    await service.saveSettings(DEFAULT_AI_MARKDOWN);
    await service.saveStageSettings({ model: 'default', enabled: true, instructions: 'Reglas.', stageInstructions: DEFAULT_STAGE_INSTRUCTIONS });
    expect((await service.getRuntimeSettings()).apiKey).toBe(newKey);
  });

  it.each(['', '  ', 'key\nheader', 'key with spaces', 'x'.repeat(4097)])('rejects invalid keys without storing them', async (value) => {
    await expect(service.saveApiKey(value)).rejects.toThrow();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('requires a server encryption secret and never stores plaintext as a fallback', async () => {
    const unconfigured = new AiEngineSettingsService(repository as unknown as Repository<AiEngineSettings>, new ConfigService({ JWT_SECRET: '', AI_SETTINGS_ENCRYPTION_KEY: '' }));
    await expect(unconfigured.saveApiKey(newKey)).rejects.toThrow('secreto de cifrado');
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('rejects tampered ciphertext without exposing secrets', async () => {
    await service.saveApiKey(newKey);
    row!.encryptedApiKey = row!.encryptedApiKey!.slice(0, -4) + 'AAAA';
    await expect(service.getRuntimeSettings()).rejects.toThrow('vuelve a guardarla');
    expect(JSON.stringify(await service.getSettings())).not.toContain(newKey);
  });

  it('automatically synchronizes after persisting the encrypted key and supports retries', async () => {
    const synchronize = jest.fn(async (value: string) => {
      expect(row!.encryptedApiKey).toMatch(/^v1\./);
      expect(value).toBe(newKey);
      return { status: 'redeploy_requested', message: 'Solicitud enviada a Vercel.' };
    });
    const integration = { isConfigured: () => true, synchronize };
    const configured = new AiEngineSettingsService(repository as unknown as Repository<AiEngineSettings>, config, integration as never);
    const result = await configured.saveApiKey(newKey);
    expect(result).toMatchObject({ vercelSyncConfigured: true, vercelSync: { status: 'redeploy_requested' } });
    await configured.retryVercelSync();
    expect(synchronize).toHaveBeenCalledTimes(2);
    expect(await configured.getSettings()).not.toHaveProperty('vercelSync');
    expect(JSON.stringify(result)).not.toContain(newKey);
  });
});
