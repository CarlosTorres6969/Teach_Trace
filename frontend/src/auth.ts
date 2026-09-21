import { reactive } from 'vue';
import { API_URL } from './api-url';
import type { User } from './types';
import { applyAccessibilitySettings, DEFAULT_ACCESSIBILITY_SETTINGS } from './accessibility';
import { applyTheme } from './theme';

const AUTH_EVENT_KEY = 'teachtrace_auth_event';
const BROADCAST_CHANNEL_NAME = 'teachtrace-auth';

let broadcastChannel: BroadcastChannel | null = null;

function getBroadcastChannel(): BroadcastChannel {
  if (!broadcastChannel) {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    broadcastChannel.onmessage = (event) => {
      const message = event.data as { type?: string; timestamp?: number };
      if (message.type === 'logout') {
        clearSession(false);
        window.location.href = '/login';
      } else if (message.type === 'login') {
        void restoreSession(true);
      }
    };
  }
  return broadcastChannel;
}

export const auth = reactive<{ user: User | null; initialized: boolean }>({
  user: null,
  initialized: false,
});

let restorePromise: Promise<void> | null = null;

export function setSession(user: User, notify = true) {
  auth.user = user;
  applyTheme(user.theme ?? 'system');
  applyAccessibilitySettings(user.accessibilitySettings ?? DEFAULT_ACCESSIBILITY_SETTINGS);
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
      const response = await fetch(`${API_URL}/auth/session`, { credentials: 'include' });
      if (!response.ok) {
        clearSession(false);
        return;
      }
      const session = (await response.json()) as { user: User | null };
      if (!session.user) {
        clearSession(false);
        return;
      }
      setSession(session.user, false);
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
  const message = { type, timestamp: Date.now() };
  
  try {
    const channel = getBroadcastChannel();
    channel.postMessage(message);
  } catch {
    localStorage.setItem(AUTH_EVENT_KEY, JSON.stringify(message));
  }
}

localStorage.removeItem('teachtrace_token');
localStorage.removeItem('teachtrace_user');

window.addEventListener('storage', (event) => {
  if (event.key !== AUTH_EVENT_KEY || !event.newValue) return;
  try {
    const message = JSON.parse(event.newValue) as { type?: string };
    if (message.type === 'logout') {
      clearSession(false);
      window.location.href = '/login';
    }
    if (message.type === 'login') void restoreSession(true);
  } catch {
  }
});

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (broadcastChannel) {
      broadcastChannel.close();
      broadcastChannel = null;
    }
  });
}
