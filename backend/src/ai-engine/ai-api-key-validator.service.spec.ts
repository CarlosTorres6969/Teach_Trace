import { ConfigService } from '@nestjs/config';
import { AiApiKeyValidatorService } from './ai-api-key-validator.service';

describe('AiApiKeyValidatorService', () => {
  const apiKey = 'AIza' + 'a'.repeat(35);
  const providerUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
  let fetchMock: jest.SpiedFunction<typeof fetch>;
  let service: AiApiKeyValidatorService;

  beforeEach(() => {
    service = new AiApiKeyValidatorService(new ConfigService({ AI_API_URL: providerUrl }));
    fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ models: [{ name: 'models/test-model' }] })));
  });

  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

  it.each([apiKey, 'AQ.' + 'b'.repeat(130)])('authenticates standard and authorization keys without generating content', async (key) => {
    expect(await service.validate(`  ${key}  `)).toBe(key);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', expect.objectContaining({
      method: 'GET', headers: { 'x-goog-api-key': key, Accept: 'application/json' }, redirect: 'error', signal: expect.any(AbortSignal),
    }));
    expect(fetchMock.mock.calls[0][0]).not.toContain(key);
    expect(fetchMock.mock.calls[0][1]).not.toHaveProperty('body');
  });

  it.each(['', 'abc', 'a'.repeat(19), 'key with spaces-long-enough', 'a'.repeat(20) + '\nheader', 'é'.repeat(30), 'a'.repeat(4097), null, 123])('rejects malformed input before contacting the provider', async (key) => {
    await expect(service.validate(key as string)).rejects.toThrow('entre 20 y 4096');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([400, 401, 403, 429, 500, 302])('never accepts a provider failure (%i) or exposes its response', async (status) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: { message: `Private provider details: ${apiKey}` } }), { status }));
    try {
      await service.validate(apiKey);
      throw new Error('Expected validation failure');
    } catch (error) {
      expect(error).toHaveProperty('status', [400, 401, 403].includes(status) ? 400 : 503);
      expect(String(error)).not.toContain(apiKey);
      expect(String(error)).not.toContain('Private provider details');
    }
  });

  it.each(['not-json', '{}', '{"models":[]}', '{"models":[{"name":"wrong-resource"}]}'])('rejects an unexpected successful response', async (body) => {
    fetchMock.mockResolvedValue(new Response(body));
    await expect(service.validate(apiKey)).rejects.toThrow('no pudo confirmar');
  });

  it.each(['', 'not-a-url', 'http://generativelanguage.googleapis.com/v1beta/openai/chat/completions', 'https://example.test/public/models', providerUrl + '?key=secret', providerUrl + '#fragment', 'https://user:pass@generativelanguage.googleapis.com/v1beta/openai/chat/completions'])('fails closed for unconfigured or unsupported providers without sending a key', async (url) => {
    service = new AiApiKeyValidatorService(new ConfigService({ AI_API_URL: url }));
    await expect(service.validate(apiKey)).rejects.toThrow('configuración del servicio');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports a connection failure without exposing fetch errors', async () => {
    fetchMock.mockRejectedValue(new Error(`Connection failed: ${apiKey}`));
    await expect(service.validate(apiKey)).rejects.toThrow('No se pudo conectar');
  });

  it('aborts slow verification after ten seconds', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation((_input, init) => new Promise((_resolve, reject) => {
      init!.signal!.addEventListener('abort', () => reject(new Error('Aborted')));
    }));
    const validation = service.validate(apiKey);
    const result = expect(validation).rejects.toThrow('No se pudo conectar');
    await jest.advanceTimersByTimeAsync(10_000);
    await result;
    expect(fetchMock.mock.calls[0][1]!.signal!.aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });
});
