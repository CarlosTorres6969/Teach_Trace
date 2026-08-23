import { reactive } from 'vue';
import { API_URL } from './api-url';
import type { User } from './types';

const AUTH_EVENT_KEY = 'teachtrace_auth_event';

export const auth = reactive<{ user: User | null; initialized: boolean }>({
  user: null,
  initialized: false,
});

let restorePromise: Promise<void> | null = null;

export function setSession(user: User, notify = true) {
  auth.user = user;
  auth.initialized = true;
  if (notify) broadcastAuthEvent('login');
}

export function clearSession(notify = true) {
  auth.user = null;
  auth.initialized = true;
  if (notify) broadcastAuthEvent('logout');
}

export async function restoreSession(force = false) {
  if (auth.initialized && !force) return;
  if (restorePromise) return restorePromise;

  restorePromise = (async () => {
    try {
      const response = await fetch(`${API_URL}/auth/me`, { credentials: 'include' });
      if (!response.ok) {
        clearSession(false);
        return;
      }
      setSession((await response.json()) as User, false);
    } catch {
      clearSession(false);
    } finally {
      auth.initialized = true;
      restorePromise = null;
    }
  })();
  return restorePromise;
}

function broadcastAuthEvent(type: 'login' | 'logout') {
  localStorage.setItem(AUTH_EVENT_KEY, JSON.stringify({ type, at: Date.now() }));
}

localStorage.removeItem('teachtrace_token');
localStorage.removeItem('teachtrace_user');

window.addEventListener('storage', (event) => {
  if (event.key !== AUTH_EVENT_KEY || !event.newValue) return;
  try {
    const message = JSON.parse(event.newValue) as { type?: string };
    if (message.type === 'logout') clearSession(false);
    if (message.type === 'login') void restoreSession(true);
  } catch {
    // Los eventos locales no válidos se ignoran sin afectar la sesión actual.
  }
});
