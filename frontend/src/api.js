import { auth, clearSession } from './auth';
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';
export class ApiError extends Error {
    status;
    constructor(message, status) {
        super(message);
        this.status = status;
    }
}
export async function api(path, options = {}) {
    const headers = new Headers(options.headers);
    if (options.body)
        headers.set('Content-Type', 'application/json');
    if (auth.token)
        headers.set('Authorization', `Bearer ${auth.token}`);
    const response = await fetch(`${API_URL}${path}`, { ...options, headers });
    if (!response.ok) {
        if (response.status === 401)
            clearSession();
        const body = (await response.json().catch(() => ({})));
        const message = Array.isArray(body.message) ? body.message.join('. ') : body.message;
        throw new ApiError(message ?? 'No fue posible completar la solicitud', response.status);
    }
    return response.json();
}
