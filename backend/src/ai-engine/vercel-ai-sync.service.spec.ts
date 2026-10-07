import { ConfigService } from '@nestjs/config';
import { VercelAiSyncService } from './vercel-ai-sync.service';

const values = {
  VERCEL_AI_SYNC_ENABLED: 'true',
  VERCEL_ENV: 'production',
  VERCEL_API_TOKEN: 'test-only-vercel-token',
  VERCEL_AI_PROJECT_ID: 'prj_backend123',
  VERCEL_AI_TEAM_ID: 'team_test',
  VERCEL_AI_DEPLOY_HOOK_URL: 'https://api.vercel.com/v1/integrations/deploy/prj_backend123/testhook',
};
const key = 'test-only-provider-key';
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
function service(overrides: Partial<typeof values> = {}) {
  const config = { ...values, ...overrides };
  return new VercelAiSyncService({ get: (name: string) => config[name as keyof typeof values] } as unknown as ConfigService);
}

describe('VercelAiSyncService', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); });

  it('updates only the backend production key before triggering its deploy hook', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(response({ created: { id: 'env_test' }, failed: [] }, 201))
      .mockResolvedValueOnce(response({ job: { id: 'job_test', state: 'PENDING' } }));
    global.fetch = fetchMock;
    const result = await service().synchronize(key);
    expect(result.status).toBe('redeploy_requested');
    const [envUrl, envOptions] = fetchMock.mock.calls[0];
    expect(envUrl).toBe('https://api.vercel.com/v10/projects/prj_backend123/env?upsert=true&teamId=team_test');
    expect(envOptions.method).toBe('POST');
    expect(JSON.parse(envOptions.body)).toEqual({ key: 'AI_API_KEY', value: key, type: 'encrypted', target: ['production'] });
    expect(envOptions.headers.Authorization).toBe('Bearer test-only-vercel-token');
    const [hookUrl, hookOptions] = fetchMock.mock.calls[1];
    expect(hookUrl).toBe(`${values.VERCEL_AI_DEPLOY_HOOK_URL}?buildCache=false`);
    expect(hookOptions.headers).toBeUndefined();
    expect(hookOptions.body).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain(key);
    expect(JSON.stringify(result)).not.toContain(values.VERCEL_API_TOKEN);
    expect(JSON.stringify(result)).not.toContain('testhook');
  });

  it.each([
    { VERCEL_AI_SYNC_ENABLED: 'false' },
    { VERCEL_API_TOKEN: '' },
    { VERCEL_ENV: 'preview' },
    { VERCEL_AI_DEPLOY_HOOK_URL: 'https://other.example/v1/integrations/deploy/prj_backend123/testhook' },
    { VERCEL_AI_DEPLOY_HOOK_URL: 'https://api.vercel.com/v1/integrations/deploy/prj_other/testhook' },
  ])('does not contact Vercel when setup is missing or invalid', async (overrides) => {
    global.fetch = jest.fn();
    expect(await service(overrides).synchronize(key)).toMatchObject({ status: 'not_configured' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it.each([
    response({ error: { message: key } }, 403),
    response({ created: { id: 'env_test' }, failed: [{ error: { value: key } }] }, 201),
  ])('does not redeploy or expose provider errors when updating the variable fails', async (providerResponse) => {
    global.fetch = jest.fn().mockResolvedValue(providerResponse);
    const result = await service().synchronize(key);
    expect(result.status).toBe('env_update_failed');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toContain(key);
  });

  it('reports the partial change when the variable updated but the deploy hook failed', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(response({ created: { id: 'env_test' }, failed: [] }))
      .mockResolvedValueOnce(response({ error: key }, 503));
    const result = await service().synchronize(key);
    expect(result.status).toBe('redeploy_failed');
    expect(result.message).toContain('se actualizó en Vercel');
    expect(JSON.stringify(result)).not.toContain(key);
  });

  it('bounds the wait for Vercel and does not retry a mutation automatically', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn().mockImplementation((_url, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal!.addEventListener('abort', () => reject(new Error('timeout')));
    }));
    const pending = service().synchronize(key);
    await jest.advanceTimersByTimeAsync(10_000);
    expect(await pending).toMatchObject({ status: 'env_update_failed' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
