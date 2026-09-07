<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from './api';
import { auth, clearSession } from './auth';
import { applyTheme, oppositeResolvedTheme, resolvedTheme } from './theme';
import type { ThemePreference } from './types';

const router = useRouter();
const savingTheme = ref(false);

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
  try {
    await api('/auth/logout', { method: 'POST' });
  } catch {
    // El token también se elimina localmente si la API ya no está disponible.
  } finally {
    clearSession();
    await router.push('/login');
  }
}
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
      <RouterLink
        v-if="auth.user.role === 'student'"
        class="button ghost"
        to="/settings/notifications"
        aria-label="Configurar notificaciones"
      >
        <span class="topbar-settings-icon" aria-hidden="true">⚙</span>
        <span class="topbar-settings-label">Notificaciones</span>
      </RouterLink>
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
