<script setup lang="ts">
import { LoaderCircleIcon } from '@lucide/vue';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { api } from './api';
import { API_URL } from './api-url';
import { auth, clearSession, setSession } from './auth';
import { homeForRole } from './role-home';
import { applyTheme, oppositeResolvedTheme, resolvedTheme } from './theme';
import type { AppNotification, Role, ThemePreference, User } from './types';
import { registerPushNotifications } from './usePush';
import PageLoader from './components/PageLoader.vue';

const router = useRouter();
const savingTheme = ref(false);
const switchingRole = ref(false);
const roleSwitchError = ref('');
const newActivityCount = ref(0);
const roleOptions = computed<Role[]>(() => {
  const roles = auth.user?.roles ?? [auth.user?.role].filter(Boolean) as Role[];
  return [...new Set(roles)].filter((role) => role === 'admin' || role === 'teacher');
});

// ─── Notificaciones ───────────────────────────────────────────────────────────
const notifications = ref<AppNotification[]>([]);
const unreadCount = ref(0);
const bellOpen = ref(false);
let pollInterval: ReturnType<typeof setInterval> | null = null;
let sseSource: EventSource | null = null;

function startNotificationServices() {
  stopNotificationServices();
  if (!auth.user || auth.user.role === 'admin') return;

  // Contar no leídas de inmediato
  void fetchUnreadCount();

  // SSE para actualización instantánea del badge
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
    pollInterval = setInterval(() => {
      void fetchUnreadCount();
      void fetchNewActivityCount();
    }, 30000);
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
  if (!auth.user) return;
  try {
    const data = await api<{ count: number }>('/notifications/unread-count');
    unreadCount.value = data.count;
  } catch {
    // silencioso — no interrumpir la app si falla el polling
  }
}

async function fetchNewActivityCount() {
  if (!auth.user || auth.user.role !== 'student') return;
  try {
    const data = await api<{ count: number }>('/student/activities/new-count');
    newActivityCount.value = data.count;
  } catch {
    // silencioso: el resto de la navegación continúa disponible
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
  if (notification.activityId) {
    void router.push(auth.user?.role === 'teacher'
      ? `/teacher/activities/${notification.activityId}/submissions`
      : `/student/activities/${notification.activityId}/results`);
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

function roleLabel() {
  if (auth.user?.role === 'admin') return 'Administrador';
  return auth.user?.role === 'student' ? 'Estudiante' : 'Docente';
}

function roleOptionLabel(role: Role) {
  if (role === 'admin') return 'Modo administrador';
  if (role === 'teacher') return 'Modo docente';
  return 'Modo estudiante';
}

async function switchRole(event: Event) {
  if (!auth.user || switchingRole.value) return;
  const select = event.target as HTMLSelectElement;
  const previousRole = auth.user.role;
  const role = select.value as Role;
  if (role === previousRole) return;
  if (!roleOptions.value.includes(role)) {
    select.value = previousRole;
    return;
  }

  switchingRole.value = true;
  roleSwitchError.value = '';
  try {
    const result = await api<{ user: User }>('/auth/switch-role', {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
    setSession(result.user);
    await router.push(homeForRole(result.user.role));
  } catch (cause) {
    select.value = previousRole;
    roleSwitchError.value = cause instanceof Error
      ? cause.message
      : 'No fue posible cambiar el modo de trabajo';
  } finally {
    switchingRole.value = false;
  }
}

function closeBellOnEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') bellOpen.value = false;
}

function refreshActivityCount() {
  void fetchNewActivityCount();
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
    if (user && !user.mustChangePassword) {
      startNotificationServices();
      void fetchNewActivityCount();
    } else {
      stopNotificationServices();
      unreadCount.value = 0;
      notifications.value = [];
      newActivityCount.value = 0;
    }
  },
);

onMounted(() => {
  window.addEventListener('keydown', closeBellOnEscape);
  // Si ya hay sesión activa al montar (recarga de página), iniciar servicios
  if (auth.user && !auth.user.mustChangePassword) {
    startNotificationServices();
    void fetchNewActivityCount();
    window.addEventListener('teachtrace:activity-viewed', refreshActivityCount);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', closeBellOnEscape);
  window.removeEventListener('teachtrace:activity-viewed', refreshActivityCount);
  stopNotificationServices();
});
</script>

<template>
  <main v-if="!auth.initialized" class="app-boot-loader">
    <PageLoader
      label="Iniciando TeachTrace…"
      detail="Estamos verificando tu sesión y preparando la plataforma."
    />
  </main>

  <header v-if="auth.user && !auth.user.mustChangePassword" class="topbar">
    <RouterLink :to="homeForRole(auth.user.role)" class="brand">
      <span class="brand-mark">T</span>
      <span>TeachTrace <small>UNAH</small></span>
    </RouterLink>

    <div class="user-menu">
      <div>
        <strong>{{ auth.user.name }}</strong>
        <span>{{ roleLabel() }}</span>
      </div>

      <label v-if="roleOptions.length > 1" class="role-switcher">
        <span class="sr-only">Cambiar modo de trabajo</span>
        <LoaderCircleIcon v-if="switchingRole" class="ui-icon icon-spin" aria-hidden="true" />
        <select
          :value="auth.user.role"
          :disabled="switchingRole"
          aria-label="Cambiar modo de trabajo"
          @change="switchRole"
        >
          <option v-for="role in roleOptions" :key="role" :value="role">
            {{ roleOptionLabel(role) }}
          </option>
        </select>
      </label>

      <RouterLink
        v-if="auth.user.role === 'student'"
        class="button ghost activities-nav-link"
        to="/student"
        :aria-label="`Mis actividades${newActivityCount ? `, ${newActivityCount} nuevas` : ''}`"
      >
        Actividades<span v-if="newActivityCount > 0" class="activities-nav-badge">{{ newActivityCount }}</span>
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
      <!-- Campana de notificaciones — solo estudiantes -->
      <div v-if="auth.user.role !== 'admin'" class="bell-wrapper">
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
              v-if="auth.user.role === 'student'"
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

  <p v-if="roleSwitchError" class="role-switch-error alert error" role="alert">
    {{ roleSwitchError }}
  </p>

  <RouterView v-if="auth.initialized" />
</template>
