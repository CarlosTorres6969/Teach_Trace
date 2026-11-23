import { api } from './api';

type UploadAuthorization =
  | { mode: 'multipart' }
  | { mode: 'direct'; uploadUrl: string; uploadToken: string };

export async function attachSubmissionFile(activityId: number, file: File, form: FormData) {
  const authorization = await api<UploadAuthorization>(
    `/student/activities/${activityId}/submission-upload`,
    {
      method: 'POST',
      body: JSON.stringify({ fileName: file.name, fileSize: file.size }),
    },
  );
  if (authorization.mode === 'multipart') {
    form.set('file', file);
    return;
  }
  let response: Response;
  try {
    response = await fetch(authorization.uploadUrl, {
      method: 'PUT',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      headers: { 'Content-Type': 'application/pdf', 'x-ms-blob-type': 'BlockBlob' },
      body: file,
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    throw new Error('No fue posible subir el PDF. Revisa tu conexión e inténtalo de nuevo.');
  }
  if (!response.ok) {
    throw new Error('No fue posible subir el PDF. Selecciona el archivo e inténtalo de nuevo.');
  }
  form.set('uploadToken', authorization.uploadToken);
}
