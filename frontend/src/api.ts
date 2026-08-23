import { clearSession } from './auth';
import { API_URL } from './api-url';

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });
  if (!response.ok) {
    if (response.status === 401) handleUnauthorized();
    const body = (await response.json().catch(() => ({}))) as { message?: string | string[] };
    const message = Array.isArray(body.message) ? body.message.join('. ') : body.message;
    throw new ApiError(message ?? 'No fue posible completar la solicitud', response.status);
  }
  return response.json() as Promise<T>;
}

export async function apiBlob(path: string): Promise<Blob> {
  const response = await fetch(`${API_URL}${path}`, { credentials: 'include' });
  if (!response.ok) {
    if (response.status === 401) handleUnauthorized();
    throw new ApiError('No fue posible descargar el archivo', response.status);
  }
  return response.blob();
}

function handleUnauthorized() {
  clearSession();
  if (window.location.pathname !== '/login') window.location.assign('/login');
}
