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
    const result = await api<{ user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(form),
    });
    setSession(result.user);
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
    <section class="identity-panel" aria-labelledby="platform-title">
      <img
        class="career-logo"
        src="/ingenieria-sistemas-unah.png"
        alt="Logotipo de Ingeniería en Sistemas de la UNAH"
      />
      <div>
        <span class="institution">Universidad Nacional Autónoma de Honduras</span>
        <h1 id="platform-title">TeachTrace</h1>
        <p>Plataforma de trazabilidad del proceso académico.</p>
      </div>
      <span class="career-name">Ingeniería en Sistemas</span>
    </section>

    <section class="login-panel" aria-label="Acceso a TeachTrace">
      <div class="login-card">
        <span class="access-label">Portal académico · UNAH</span>
        <h2>Iniciar sesión</h2>
        <p class="muted">Ingresa con una cuenta institucional autorizada.</p>
        <form @submit.prevent="login">
          <label>Correo institucional<input v-model.trim="form.email" type="email" autocomplete="username" required /></label>
          <label>Contraseña<input v-model="form.password" type="password" autocomplete="current-password" minlength="8" required /></label>
          <RouterLink class="back-link login-forgot-link" to="/forgot-password">¿Olvidaste tu contraseña?</RouterLink>
          <p v-if="error" class="alert error">{{ error }}</p>
          <button class="button primary full" :disabled="loading">
            {{ loading ? 'Ingresando…' : 'Ingresar al sistema' }}
          </button>
        </form>
        <div class="demo-box">
          <span>Acceso de demostración</span>
          <button class="text-button" type="button" @click="useDemo('student')">Usar estudiante</button>
          <button class="text-button" type="button" @click="useDemo('teacher')">Usar docente</button>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@700;800&family=Inter:wght@400;500;600;700&display=swap');

.login-shell {
  display: grid;
  grid-template-columns: minmax(240px, 360px) minmax(380px, 460px);
  align-items: center;
  justify-content: center;
  gap: clamp(2rem, 6vw, 5.5rem);
  min-height: 100vh;
  padding: 1.5rem;
  background: #173f78;
}

.identity-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  width: 100%;
  padding: 0;
  color: white;
  background: transparent;
  text-align: center;
}
.career-logo { width: clamp(150px, 16vw, 205px); height: auto; }
.institution { display: block; margin-bottom: .65rem; color: #cbd9eb; font: 600 .72rem 'Inter', system-ui, sans-serif; letter-spacing: .09em; text-transform: uppercase; }
.identity-panel h1 { margin-bottom: .35rem; color: white; font: 800 clamp(2.4rem, 4vw, 3.4rem)/1 'Poppins', system-ui, sans-serif; letter-spacing: -.04em; }
.identity-panel p { max-width: 360px; margin: 0 auto; color: #dbe5f1; font: 500 1rem/1.6 'Inter', system-ui, sans-serif; }
.career-name { color: #f5a623; font: 700 .75rem 'Inter', system-ui, sans-serif; letter-spacing: .08em; text-transform: uppercase; }

.login-panel { width: 100%; display: grid; place-items: center; padding: 0; }
.login-card {
  width: min(460px, 100%);
  margin: 0;
  padding: clamp(1.75rem, 4vw, 3rem);
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--paper);
  box-shadow: none;
}
.access-label { display: block; margin-bottom: .65rem; color: var(--green); font: 700 .68rem 'Inter', system-ui, sans-serif; letter-spacing: .1em; text-transform: uppercase; }
.login-card h2 {
  margin-bottom: .45rem;
  font-family: 'Poppins', system-ui, sans-serif;
  font-weight: 800;
  color: var(--ink);
}
.login-card .muted {
  color: var(--muted);
  font-family: 'Inter', system-ui, sans-serif;
}
.login-card label {
  color: var(--ink);
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 600;
}
.login-card input {
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 6px;
  color: var(--ink);
  font-family: 'Inter', system-ui, sans-serif;
}
.login-card input:focus {
  border-color: var(--green);
  box-shadow: 0 0 0 3px rgba(31, 74, 134, 0.15);
}
.login-card .button.primary {
  background: #f5a623;
  color: #0c2340;
  border-radius: 6px;
  font-family: 'Poppins', system-ui, sans-serif;
  font-weight: 700;
  transition: background-color 0.15s;
}
.login-card .button.primary:hover:not(:disabled) {
  background: #e0941a;
}
.login-card .alert.error {
  font-family: 'Inter', system-ui, sans-serif;
  border-radius: 6px;
}
.demo-box {
  border-top-color: var(--line);
  font-family: 'Inter', system-ui, sans-serif;
}
.demo-box span {
  color: var(--muted);
}
.demo-box .text-button {
  color: var(--green);
  font-weight: 700;
}

@media (max-width: 800px) {
  .login-shell { grid-template-columns: 1fr; }
  .identity-panel { max-width: 460px; flex-direction: row; justify-content: center; gap: 1rem; text-align: left; }
  .career-logo { width: 90px; }
  .identity-panel h1 { margin: 0; font-size: 2.25rem; }
  .identity-panel p { display: none; }
  .career-name { display: none; }
  .login-panel { padding: 0; }
}

@media (max-width: 560px) {
  .login-shell { align-content: start; gap: 1.25rem; padding-top: 1.5rem; }
  .identity-panel { justify-content: flex-start; gap: .75rem; }
  .career-logo { width: 76px; }
  .institution { font-size: .58rem; }
  .identity-panel h1 { font-size: 2rem; }
  .login-card { padding: 1.5rem; }
  .demo-box { display: grid; grid-template-columns: 1fr 1fr; }
  .demo-box span { grid-column: 1 / -1; }
}

@media (min-width: 801px) and (max-height: 720px) {
  .career-logo { width: 145px; }
  .identity-panel h1 { font-size: 2.7rem; }
  .login-card { padding: 1.8rem 2.2rem; }
  .login-card form { margin-top: 1.25rem; gap: .85rem; }
  .demo-box { margin-top: 1rem; }
}
</style>
