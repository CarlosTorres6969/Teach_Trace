<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api';
import { auth, clearSession, setSession } from '../auth';
import type { User } from '../types';

const router = useRouter();
const form = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' });
const loading = ref(false);
const error = ref('');

async function changePassword() {
  error.value = '';
  if (form.newPassword !== form.confirmPassword) {
    error.value = 'Las contraseñas nuevas no coinciden.';
    return;
  }
  if (form.currentPassword === form.newPassword) {
    error.value = 'La nueva contraseña debe ser diferente de la temporal.';
    return;
  }

  loading.value = true;
  try {
    const result = await api<{ user: User }>('/auth/temporary-password/change', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      }),
    });
    setSession(result.user);
    await router.push(result.user.role === 'student' ? '/student' : '/teacher');
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No fue posible cambiar la contraseña';
  } finally {
    loading.value = false;
  }
}

async function logout() {
  try {
    await api('/auth/logout', { method: 'POST' });
  } catch {
    // La sesión local debe cerrarse aunque el servidor no responda.
  } finally {
    clearSession();
    await router.push('/login');
  }
}
</script>

<template>
  <main class="security-shell">
    <section class="security-identity" aria-labelledby="temporary-password-title">
      <img class="career-logo" src="/ingenieria-sistemas-unah.png" alt="Logotipo de Ingeniería en Sistemas de la UNAH" />
      <div>
        <span class="institution">Universidad Nacional Autónoma de Honduras</span>
        <h1 id="temporary-password-title">TeachTrace</h1>
        <p>Protege tu cuenta antes de continuar.</p>
      </div>
      <span class="career-name">Ingeniería en Sistemas</span>
    </section>

    <section class="security-panel" aria-label="Cambiar contraseña temporal">
      <div class="security-card">
        <span class="access-label">Primer inicio de sesión</span>
        <h2>Cambia tu contraseña temporal</h2>
        <p class="muted">Escribe la contraseña recibida por correo y define una nueva de al menos 8 caracteres.</p>
        <form @submit.prevent="changePassword">
          <input
            class="sr-only"
            type="email"
            autocomplete="username"
            :value="auth.user?.email ?? ''"
            tabindex="-1"
            aria-hidden="true"
            readonly
          />
          <label>Contraseña temporal<input v-model="form.currentPassword" type="password" autocomplete="current-password" minlength="8" maxlength="128" required /></label>
          <label>Nueva contraseña<input v-model="form.newPassword" type="password" autocomplete="new-password" minlength="8" maxlength="128" required /></label>
          <label>Confirmar contraseña<input v-model="form.confirmPassword" type="password" autocomplete="new-password" minlength="8" maxlength="128" required /></label>
          <p v-if="error" class="alert error">{{ error }}</p>
          <button class="button primary full" :disabled="loading">
            {{ loading ? 'Actualizando…' : 'Guardar nueva contraseña' }}
          </button>
        </form>
        <button class="logout-button" type="button" :disabled="loading" @click="logout">
          Cerrar sesión
        </button>
      </div>
    </section>
  </main>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@700;800&family=Inter:wght@400;500;600;700&display=swap');

.security-shell {
  display: grid;
  grid-template-columns: minmax(240px, 360px) minmax(380px, 460px);
  align-items: center;
  justify-content: center;
  gap: clamp(2rem, 6vw, 5.5rem);
  min-height: 100vh;
  padding: 1.5rem;
  background: #173f78;
}

.security-identity {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  width: 100%;
  color: white;
  text-align: center;
}

.career-logo { width: clamp(150px, 16vw, 205px); height: auto; }
.institution {
  display: block;
  margin-bottom: .65rem;
  color: #cbd9eb;
  font: 600 .72rem 'Inter', system-ui, sans-serif;
  letter-spacing: .09em;
  text-transform: uppercase;
}
.security-identity h1 {
  margin-bottom: .35rem;
  color: white;
  font: 800 clamp(2.4rem, 4vw, 3.4rem)/1 'Poppins', system-ui, sans-serif;
  letter-spacing: -.04em;
}
.security-identity p {
  max-width: 360px;
  margin: 0 auto;
  color: #dbe5f1;
  font: 500 1rem/1.6 'Inter', system-ui, sans-serif;
}
.career-name {
  color: #f5a623;
  font: 700 .75rem 'Inter', system-ui, sans-serif;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.security-panel { width: 100%; display: grid; place-items: center; }
.security-card {
  width: min(460px, 100%);
  padding: clamp(1.75rem, 4vw, 3rem);
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--paper);
  box-shadow: 0 24px 60px rgba(7, 25, 50, .24);
}
.access-label {
  display: block;
  margin-bottom: .65rem;
  color: var(--green);
  font: 700 .68rem 'Inter', system-ui, sans-serif;
  letter-spacing: .1em;
  text-transform: uppercase;
}
.security-card h2 {
  margin-bottom: .45rem;
  color: var(--ink);
  font-family: 'Poppins', system-ui, sans-serif;
  font-weight: 800;
}
.security-card .muted { color: var(--muted); font-family: 'Inter', system-ui, sans-serif; line-height: 1.5; }
.security-card form { display: grid; gap: 1rem; margin-top: 1.5rem; }
.security-card label { color: var(--ink); font-family: 'Inter', system-ui, sans-serif; font-weight: 600; }
.security-card input { background: var(--paper); border-radius: 6px; color: var(--ink); font-family: 'Inter', system-ui, sans-serif; }
.security-card input:focus { border-color: var(--green); box-shadow: 0 0 0 3px rgba(31, 74, 134, .15); }
.security-card .button.primary { border-radius: 6px; background: #f5a623; color: #0c2340; font-family: 'Poppins', system-ui, sans-serif; }
.security-card .button.primary:hover:not(:disabled) { background: #e0941a; }
.logout-button {
  width: 100%;
  margin-top: .8rem;
  padding: .65rem;
  border: 0;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-weight: 700;
}
.logout-button:hover:not(:disabled) { color: var(--ink); text-decoration: underline; }
.logout-button:disabled { cursor: wait; opacity: .6; }

@media (max-width: 800px) {
  .security-shell { grid-template-columns: 1fr; gap: 1.5rem; }
  .security-identity { max-width: 460px; margin: 0 auto; flex-direction: row; justify-content: center; text-align: left; }
  .career-logo { width: 90px; }
  .security-identity h1 { margin: 0; font-size: 2.25rem; }
  .security-identity p, .career-name { display: none; }
}

@media (max-width: 560px) {
  .security-shell { align-content: start; gap: 1.25rem; padding: 1.25rem 1rem 2rem; }
  .security-identity { justify-content: flex-start; gap: .75rem; }
  .career-logo { width: 72px; }
  .institution { font-size: .55rem; }
  .security-identity h1 { font-size: 1.9rem; }
  .security-card { padding: 1.4rem; }
}

@media (min-width: 801px) and (max-height: 760px) {
  .career-logo { width: 135px; }
  .security-identity h1 { font-size: 2.6rem; }
  .security-card { padding: 1.6rem 2.1rem; }
  .security-card form { margin-top: 1rem; gap: .75rem; }
}
</style>
