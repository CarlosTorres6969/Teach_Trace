// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';

describe('api', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('interpreta una respuesta exitosa sin contenido como null', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api<null>('/student/activities/4/ai-conversation')).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/student/activities/4/ai-conversation'),
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('continúa interpretando normalmente las respuestas JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ messages: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expect(api<{ messages: unknown[] }>('/test')).resolves.toEqual({ messages: [] });
  });
});
