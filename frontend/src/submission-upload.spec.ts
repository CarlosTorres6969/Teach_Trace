// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachSubmissionFile } from './submission-upload';
import { api } from './api';

vi.mock('./api', () => ({ api: vi.fn() }));

describe('carga directa del PDF', () => {
  beforeEach(() => vi.mocked(api).mockReset());
  afterEach(() => vi.unstubAllGlobals());

  it('envía un PDF de 10 MB al almacenamiento y solo su autorización a la API', async () => {
    const file = new File(['%PDF-', new Uint8Array(10 * 1024 * 1024 - 5)], 'trabajo.pdf', { type: 'application/pdf' });
    vi.mocked(api).mockResolvedValue({ mode: 'direct', uploadUrl: 'https://storage.example/file?sas', uploadToken: 'receipt' });
    const fetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetch);
    const form = new FormData();
    await attachSubmissionFile(23, file, form);
    expect(api).toHaveBeenCalledWith('/student/activities/23/submission-upload', {
      method: 'POST', body: JSON.stringify({ fileName: 'trabajo.pdf', fileSize: 10 * 1024 * 1024 }),
    });
    expect(fetch).toHaveBeenCalledWith('https://storage.example/file?sas', expect.objectContaining({
      method: 'PUT', body: file, credentials: 'omit', referrerPolicy: 'no-referrer',
      headers: { 'Content-Type': 'application/pdf', 'x-ms-blob-type': 'BlockBlob' },
    }));
    expect(form.get('uploadToken')).toBe('receipt');
    expect(form.has('file')).toBe(false);
  });

  it('conserva multipart cuando el servidor usa almacenamiento local', async () => {
    vi.mocked(api).mockResolvedValue({ mode: 'multipart' });
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const file = new File(['%PDF-'], 'trabajo.pdf', { type: 'application/pdf' });
    const form = new FormData();
    await attachSubmissionFile(23, file, form);
    expect(form.get('file')).toBe(file);
    expect(form.has('uploadToken')).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(['network', 'storage'])('no autoriza una entrega si falla la subida: %s', async (failure) => {
    vi.mocked(api).mockResolvedValue({ mode: 'direct', uploadUrl: 'https://storage.example/file?secret', uploadToken: 'receipt' });
    vi.stubGlobal('fetch', failure === 'network'
      ? vi.fn().mockRejectedValue(new Error('secret URL'))
      : vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    const form = new FormData();
    await expect(attachSubmissionFile(23, new File(['%PDF-'], 'trabajo.pdf'), form))
      .rejects.toThrow('No fue posible subir el PDF');
    expect(form.has('uploadToken')).toBe(false);
  });
});
