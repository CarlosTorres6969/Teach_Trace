<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api';
import { setSession } from '../auth';
import type { User } from '../types';

const router = useRouter();
const form = reactive({ email: '', password: '' });
const error = ref('');
const loading = ref(false);

async function login() {
  error.value = '';
  loading.value = true;
  try {
    const result = await api<{ accessToken: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(form),
    });
    setSession(result.accessToken, result.user);
    await router.push(result.user.role === 'student' ? '/student' : '/teacher');
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No fue posible iniciar sesión';
  } finally {
    loading.value = false;
  }
}

function useDemo(role: 'student' | 'teacher') {
  form.email = role === 'student' ? 'estudiante@unah.edu.hn' : 'docente@unah.edu.hn';
  form.password = role === 'student' ? 'Estudiante123!' : 'Docente123!';
}
</script>

<template>
  <main class="login-shell">
    <section class="login-intro">
      <span class="eyebrow">Rally de Innovación Educativa 2026</span>
      <h1>El proceso también cuenta.</h1>
      <p>
        Documenta cómo aprendes, declara el uso de inteligencia artificial y conserva la decisión docente
        en el centro de la evaluación.
      </p>
      <div class="principle">La IA orienta. El docente decide.</div>
    </section>

    <section class="login-card">
      <div class="logo-row"><span class="brand-mark">T</span><strong>TeachTrace UNAH</strong></div>
      <h2>Iniciar sesión</h2>
      <p class="muted">Ingresa con una cuenta institucional autorizada.</p>
      <form @submit.prevent="login">
        <label>Correo institucional<input v-model.trim="form.email" type="email" required /></label>
        <label>Contraseña<input v-model="form.password" type="password" minlength="8" required /></label>
        <p v-if="error" class="alert error">{{ error }}</p>
        <button class="button primary full" :disabled="loading">
          {{ loading ? 'Ingresando…' : 'Ingresar' }}
        </button>
      </form>
      <div class="demo-box">
        <span>Acceso de demostración</span>
        <button class="text-button" type="button" @click="useDemo('student')">Usar estudiante</button>
        <button class="text-button" type="button" @click="useDemo('teacher')">Usar docente</button>
      </div>
    </section>
  </main>
</template>
