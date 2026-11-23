// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';
import { prepareTeacherContextFile } from './teacher-context-upload';

vi.mock('./api', () => ({ api: vi.fn() }));

describe('Carga de contexto privado', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.mocked(api).mockReset(); });

  it('sube Word directamente con el MIME autorizado sin cookies de la aplicación', async () => {
    const mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    vi.mocked(api).mockResolvedValue({ mode: 'direct', mimeType, uploadUrl: 'https://storage.example/context?sas', uploadToken: 'private-receipt' });
    const fetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetch);
    const file = new File(['Word'], 'privado.docx', { type: '' });
    const form = await prepareTeacherContextFile(11, file);
    expect(api).toHaveBeenCalledWith('/teacher/activities/11/teacher-context/upload', { method: 'POST', body: JSON.stringify({ fileName: 'privado.docx', fileSize: file.size }) });
    expect(fetch).toHaveBeenCalledWith('https://storage.example/context?sas', expect.objectContaining({
      body: file, method: 'PUT', credentials: 'omit', referrerPolicy: 'no-referrer',
      headers: { 'Content-Type': mimeType, 'x-ms-blob-type': 'BlockBlob' },
    }));
    expect(form.get('uploadToken')).toBe('private-receipt');
    expect(form.has('file')).toBe(false);
  });

  it('no registra la referencia si falla la carga', async () => {
    vi.mocked(api).mockResolvedValue({ mode: 'direct', mimeType: 'application/pdf', uploadUrl: 'https://storage.example/doc?secret', uploadToken: 'receipt' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('secret url')));
    await expect(prepareTeacherContextFile(11, new File(['%PDF-'], 'doc.pdf'))).rejects.toThrow('No fue posible subir el documento');
  });
});
