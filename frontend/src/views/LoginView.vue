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
    <section class="login-card">
      <div class="logo-row"><span class="brand-mark">T</span><strong>TeachTrace <span class="accent">UNAH</span></strong></div>
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

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@700;800&family=Inter:wght@400;500;600;700&display=swap');

.login-shell {
  position: relative;
  overflow: hidden;
  display: grid;
  grid-template-columns: 1fr;
  place-items: center;
  padding: 1.5rem;
  background:
    radial-gradient(circle 320px at 85% 10%, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0) 72%),
    radial-gradient(circle 380px at 5% 20%, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0) 72%),
    radial-gradient(circle 420px at 95% 82%, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0) 72%),
    radial-gradient(circle 340px at 10% 92%, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0) 72%),
    radial-gradient(circle 260px at 50% 45%, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0) 70%),
    radial-gradient(circle at top right, #4a76b4 0%, #234f8f 45%, #0c2340 100%);
}

/* Card de login (fondo blanco) */
.login-card {
  background: #ffffff;
  border-radius: 20px;
  box-shadow: 0 25px 60px rgba(12, 35, 64, 0.35);
}
.brand-mark {
  background: #f5a623;
  color: #0c2340;
  border-radius: 8px;
  font-family: 'Poppins', system-ui, sans-serif;
  font-weight: 800;
}
.logo-row strong {
  font-family: 'Poppins', system-ui, sans-serif;
  font-weight: 700;
  color: #0c2340;
  font-size: 1.05rem;
}
.logo-row .accent {
  color: #f5a623;
}
.login-card h2 {
  font-family: 'Poppins', system-ui, sans-serif;
  font-weight: 800;
  color: #0c2340;
}
.login-card .muted {
  color: #6b7280;
  font-family: 'Inter', system-ui, sans-serif;
}
.login-card label {
  color: #0c2340;
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 600;
}
.login-card input {
  background: #f7f9fc;
  border: 1px solid #e3e6ed;
  border-radius: 10px;
  color: #0c2340;
  font-family: 'Inter', system-ui, sans-serif;
}
.login-card input:focus {
  border-color: #1f4a86;
  box-shadow: 0 0 0 3px rgba(31, 74, 134, 0.15);
}
.login-card .button.primary {
  background: #f5a623;
  color: #0c2340;
  border-radius: 999px;
  font-family: 'Poppins', system-ui, sans-serif;
  font-weight: 700;
  transition: background-color 0.15s;
}
.login-card .button.primary:hover:not(:disabled) {
  background: #e0941a;
}
.login-card .alert.error {
  font-family: 'Inter', system-ui, sans-serif;
  border-radius: 10px;
}
.demo-box {
  border-top-color: #e3e6ed;
  font-family: 'Inter', system-ui, sans-serif;
}
.demo-box span {
  color: #6b7280;
}
.demo-box .text-button {
  color: #1f4a86;
  font-weight: 700;
}
</style>
