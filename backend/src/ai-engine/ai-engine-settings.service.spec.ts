import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { AiEngineSettings } from '../entities/ai-engine-settings.entity';
import { AiEngineSettingsService, DEFAULT_AI_MARKDOWN, parseAiMarkdown } from './ai-engine-settings.service';

describe('AiEngineSettingsService', () => {
  const repository = { findOneBy: jest.fn(), create: jest.fn((value) => value), save: jest.fn() };
  const config = new ConfigService({ AI_MODEL: 'server-model', AI_API_URL: 'https://example.test', AI_API_KEY: 'secret' });
  const service = new AiEngineSettingsService(repository as unknown as Repository<AiEngineSettings>, config);

  beforeEach(() => jest.clearAllMocks());

  it('uses the server model before an administrator saves a configuration', async () => {
    repository.findOneBy.mockResolvedValue(null);
    expect(await service.getSettings()).toMatchObject({ markdown: DEFAULT_AI_MARKDOWN, effectiveModel: 'server-model', enabled: true });
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
});
