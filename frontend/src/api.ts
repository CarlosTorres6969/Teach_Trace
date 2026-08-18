import { auth, clearSession } from './auth';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

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
  if (auth.token) headers.set('Authorization', `Bearer ${auth.token}`);
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!response.ok) {
    if (response.status === 401) clearSession();
    const body = (await response.json().catch(() => ({}))) as { message?: string | string[] };
    const message = Array.isArray(body.message) ? body.message.join('. ') : body.message;
    throw new ApiError(message ?? 'No fue posible completar la solicitud', response.status);
  }
  return response.json() as Promise<T>;
}

export async function apiBlob(path: string): Promise<Blob> {
  const headers = new Headers();
  if (auth.token) headers.set('Authorization', `Bearer ${auth.token}`);
  const response = await fetch(`${API_URL}${path}`, { headers });
  if (!response.ok) {
    if (response.status === 401) clearSession();
    throw new ApiError('No fue posible descargar el archivo', response.status);
  }
  return response.blob();
}
