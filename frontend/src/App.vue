<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { api } from './api';
import { API_URL } from './api-url';
import { auth, clearSession } from './auth';
import { applyTheme, oppositeResolvedTheme, resolvedTheme } from './theme';
import type { AppNotification, ThemePreference } from './types';
import { registerPushNotifications } from './usePush';

const router = useRouter();
const savingTheme = ref(false);

// ─── Notificaciones ───────────────────────────────────────────────────────────
const notifications = ref<AppNotification[]>([]);
const unreadCount = ref(0);
const bellOpen = ref(false);
let pollInterval: ReturnType<typeof setInterval> | null = null;
let sseSource: EventSource | null = null;

function startNotificationServices() {
  if (!auth.user || auth.user.role !== 'student') return;

  // Contar no leídas de inmediato
  void fetchUnreadCount();

  // SSE para actualización instantánea del badge
  stopNotificationServices();
  const sseUrl = `${API_URL}/notifications/badge-stream`;
  sseSource = new EventSource(sseUrl, { withCredentials: true });
  sseSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data as string) as { count: number };
      unreadCount.value = data.count;
    } catch { /* silencioso */ }
  };
  sseSource.onerror = () => {
    // SSE falló — cerrar y dejar que el polling lo cubra
    sseSource?.close();
    sseSource = null;
  };

  // Polling cada 30 segundos como respaldo si SSE falla
  if (!pollInterval) {
    pollInterval = setInterval(() => { void fetchUnreadCount(); }, 30000);
  }

  // Registrar service worker y suscripción push
  void registerPushNotifications();
}

function stopNotificationServices() {
  if (sseSource) {
    sseSource.close();
    sseSource = null;
  }
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

async function fetchUnreadCount() {
  if (!auth.user || auth.user.role !== 'student') return;
  try {
    const data = await api<{ count: number }>('/notifications/unread-count');
    unreadCount.value = data.count;
  } catch {
    // silencioso — no interrumpir la app si falla el polling
  }
}

async function openBell() {
  bellOpen.value = !bellOpen.value;
  if (bellOpen.value) {
    try {
      notifications.value = await api<AppNotification[]>('/notifications');
      unreadCount.value = notifications.value.filter((n) => !n.read).length;
    } catch {
      // silencioso
    }
  }
}

async function markRead(notification: AppNotification) {
  if (notification.read) {
    navigateToNotification(notification);
    return;
  }
  try {
    await api(`/notifications/${notification.id}/read`, { method: 'PUT' });
    notification.read = true;
    unreadCount.value = Math.max(0, unreadCount.value - 1);
  } catch {
    // silencioso
  }
  navigateToNotification(notification);
}

function navigateToNotification(notification: AppNotification) {
  bellOpen.value = false;
  if (notification.type === 'MESSAGE_RECEIVED' && notification.conversationId) {
    void router.push(`/student/messages/${notification.conversationId}`);
  } else if (notification.activityId) {
    void router.push(`/student/activities/${notification.activityId}/results`);
  }
}

async function markAllRead() {
  try {
    notifications.value = await api<AppNotification[]>('/notifications/read-all', {
      method: 'PUT',
    });
    unreadCount.value = 0;
  } catch {
    // silencioso
  }
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Ahora';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `Hace ${diffHr} h`;
  const diffDays = Math.floor(diffHr / 24);
  return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
}

function closeBellOnEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') bellOpen.value = false;
}

// ─── Tema ─────────────────────────────────────────────────────────────────────
async function toggleTheme() {
  if (!auth.user || savingTheme.value) return;
  const previousTheme = auth.user.theme ?? 'system';
  const nextTheme = oppositeResolvedTheme();
  applyTheme(nextTheme);
  auth.user.theme = nextTheme;
  savingTheme.value = true;
  try {
    const result = await api<{ theme: ThemePreference }>('/users/me/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ theme: nextTheme }),
    });
    auth.user.theme = result.theme;
    applyTheme(result.theme);
  } catch {
    auth.user.theme = previousTheme;
    applyTheme(previousTheme);
  } finally {
    savingTheme.value = false;
  }
}

async function logout() {
  if (auth.user?.role === 'student') {
    const { unregisterPushNotifications } = await import('./usePush');
    await unregisterPushNotifications().catch(() => {});
  }
  try {
    await api('/auth/logout', { method: 'POST' });
  } catch {
    // token también se limpia localmente
  } finally {
    clearSession();
    await router.push('/login');
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
// Reacciona al login/logout sin necesitar recargar la página
watch(
  () => auth.user,
  (user) => {
    if (user?.role === 'student') {
      startNotificationServices();
    } else {
      stopNotificationServices();
      unreadCount.value = 0;
      notifications.value = [];
    }
  },
);

onMounted(() => {
  window.addEventListener('keydown', closeBellOnEscape);
  // Si ya hay sesión activa al montar (recarga de página), iniciar servicios
  if (auth.user?.role === 'student') {
    startNotificationServices();
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', closeBellOnEscape);
  stopNotificationServices();
});
</script>

<template>
  <header v-if="auth.user" class="topbar">
    <RouterLink :to="auth.user.role === 'student' ? '/student' : '/teacher'" class="brand">
      <span class="brand-mark">T</span>
      <span>TeachTrace <small>UNAH</small></span>
    </RouterLink>

    <div class="user-menu">
      <div>
        <strong>{{ auth.user.name }}</strong>
        <span>{{ auth.user.role === 'student' ? 'Estudiante' : 'Docente' }}</span>
      </div>

      <!-- Enlace a mensajes según rol -->
      <RouterLink
        v-if="auth.user.role === 'student'"
        class="button ghost"
        to="/student/messages"
        aria-label="Mis mensajes"
      >
        💬 Mensajes
      </RouterLink>
      <RouterLink
        v-if="auth.user.role === 'student'"
        class="button ghost"
        to="/student/profile"
        aria-label="Mi perfil académico"
      >
        📊 Mi perfil
      </RouterLink>
      <RouterLink
        v-if="auth.user.role === 'student'"
        class="button ghost"
        to="/settings/accessibility"
        aria-label="Configuración de accesibilidad"
      >
        <span aria-hidden="true">Aa</span>
        <span class="topbar-settings-label">Accesibilidad</span>
      </RouterLink>
      <RouterLink
        v-else-if="auth.user.role === 'teacher'"
        class="button ghost"
        to="/teacher/messages"
        aria-label="Mensajes de estudiantes"
      >
        💬 Mensajes
      </RouterLink>

      <!-- Campana de notificaciones — solo estudiantes -->
      <div v-if="auth.user.role === 'student'" class="bell-wrapper">
        <button
          class="button ghost bell-button"
          type="button"
          :aria-label="`Notificaciones${unreadCount > 0 ? ` — ${unreadCount} sin leer` : ''}`"
          :aria-expanded="bellOpen"
          @click="openBell"
        >
          <span aria-hidden="true">🔔</span>
          <span v-if="unreadCount > 0" class="bell-badge" aria-hidden="true">
            {{ unreadCount > 99 ? '99+' : unreadCount }}
          </span>
        </button>

        <!-- Dropdown de notificaciones -->
        <div v-if="bellOpen" class="bell-dropdown" role="dialog" aria-label="Notificaciones">
          <div class="bell-dropdown-header">
            <strong>Notificaciones</strong>
            <button
              v-if="notifications.some((n) => !n.read)"
              class="text-button"
              type="button"
              @click="markAllRead"
            >
              Marcar todas como leídas
            </button>
          </div>

          <div class="bell-dropdown-body">
            <p v-if="!notifications.length" class="bell-empty">
              No tienes notificaciones recientes.
            </p>
            <button
              v-for="n in notifications"
              :key="n.id"
              class="bell-item"
              :class="{ 'bell-item--unread': !n.read }"
              type="button"
              @click="markRead(n)"
            >
              <span class="bell-item-dot" aria-hidden="true" />
              <div class="bell-item-content">
                <strong>{{ n.title }}</strong>
                <span>{{ n.message }}</span>
                <small>{{ formatDate(n.createdAt) }}</small>
              </div>
            </button>
          </div>

          <div class="bell-dropdown-footer">
            <RouterLink
              class="text-button"
              to="/settings/notifications"
              @click="bellOpen = false"
            >
              ⚙ Configurar notificaciones
            </RouterLink>
          </div>
        </div>

        <!-- Backdrop invisible para cerrar el dropdown al hacer clic fuera -->
        <div v-if="bellOpen" class="bell-backdrop" @click="bellOpen = false" />
      </div>

      <button
        class="button ghost theme-toggle"
        type="button"
        :disabled="savingTheme"
        :aria-label="resolvedTheme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'"
        :title="resolvedTheme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'"
        @click="toggleTheme"
      >
        <span aria-hidden="true">{{ resolvedTheme === 'dark' ? '☀' : '☾' }}</span>
      </button>

      <button class="button ghost" type="button" @click="logout">Cerrar sesión</button>
    </div>
  </header>

  <RouterView />
</template>
