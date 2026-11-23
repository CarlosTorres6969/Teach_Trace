import { api } from './api';

export async function prepareTeacherContextFile(activityId: number, file: File) {
  const authorization = await api<{
    mode: 'direct' | 'multipart'; mimeType: string; uploadUrl?: string; uploadToken?: string;
  }>(`/teacher/activities/${activityId}/teacher-context/upload`, {
    method: 'POST', body: JSON.stringify({ fileName: file.name, fileSize: file.size }),
  });
  const form = new FormData();
  if (authorization.mode === 'multipart') {
    form.set('file', file);
    return form;
  }
  try {
    const response = await fetch(authorization.uploadUrl!, {
      method: 'PUT', credentials: 'omit', referrerPolicy: 'no-referrer',
      headers: { 'Content-Type': authorization.mimeType, 'x-ms-blob-type': 'BlockBlob' },
      body: file, signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) throw new Error('Upload failed');
  } catch {
    throw new Error('No fue posible subir el documento. Revisa tu conexión y vuelve a seleccionarlo.');
  }
  form.set('uploadToken', authorization.uploadToken!);
  return form;
}
