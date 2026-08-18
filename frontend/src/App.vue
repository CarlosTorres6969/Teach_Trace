<script setup lang="ts">
import { useRouter } from 'vue-router';
import { api } from './api';
import { auth, clearSession } from './auth';

const router = useRouter();

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
      <button class="button ghost" type="button" @click="logout">Cerrar sesión</button>
    </div>
  </header>
  <RouterView />
</template>
