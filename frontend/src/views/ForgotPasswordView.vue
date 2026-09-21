<script setup lang="ts">
import { reactive, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { api } from '../api';

const form = reactive({ email: '' });
const loading = ref(false);
const submitted = ref(false);
const error = ref('');
const developmentResetUrl = ref('');

async function requestReset() {
  error.value = '';
  loading.value = true;
  try {
    const result = await api<{ resetUrl?: string }>('/auth/password-reset/request', {
      method: 'POST',
      body: JSON.stringify(form),
    });
    developmentResetUrl.value = result.resetUrl ?? '';
    submitted.value = true;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No fue posible procesar la solicitud';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="login-shell">
    <section class="identity-panel" aria-labelledby="platform-title">
      <img class="career-logo" src="/ingenieria-sistemas-unah.png" alt="Logotipo de Ingeniería en Sistemas de la UNAH" />
      <div>
        <span class="institution">Universidad Nacional Autónoma de Honduras</span>
        <h1 id="platform-title">TeachTrace</h1>
        <p>Recupera el acceso a tu cuenta institucional.</p>
      </div>
      <span class="career-name">Ingeniería en Sistemas</span>
    </section>
    <section class="login-panel" aria-label="Recuperación de contraseña">
      <div class="login-card">
        <span class="access-label">Seguridad de la cuenta</span>
        <h2>Recuperar contraseña</h2>
        <p class="muted">Escribe tu correo institucional y te enviaremos un enlace de recuperación.</p>
        <div v-if="submitted" class="alert success">Si el correo está registrado, recibirás un enlace para recuperar tu contraseña. Revisa también la carpeta de correo no deseado.</div>
        <div v-if="submitted && developmentResetUrl" class="development-reset-link">
          <strong>Enlace de desarrollo:</strong>
          <a :href="developmentResetUrl">Continuar con la recuperaciÃ³n</a>
        </div>
        <form v-else @submit.prevent="requestReset">
          <label>Correo institucional<input v-model.trim="form.email" type="email" autocomplete="email" required /></label>
          <p v-if="error" class="alert error">{{ error }}</p>
          <button class="button primary full" :disabled="loading">{{ loading ? 'Enviando…' : 'Enviar enlace' }}</button>
        </form>
        <RouterLink class="back-link" to="/login">Volver a iniciar sesión</RouterLink>
      </div>
    </section>
  </main>
</template>

<style scoped>
.login-shell {
  min-height: 100vh;
  min-height: 100dvh;
  display: grid;
  grid-template-columns: minmax(0, 360px) minmax(0, 460px);
  align-items: center;
  justify-content: center;
  gap: clamp(2rem, 6vw, 5rem);
  padding: clamp(1.25rem, 4vw, 3rem);
  background: #173f78;
}
.identity-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  min-width: 0;
  color: white;
  text-align: center;
}
.career-logo { width: clamp(140px, 16vw, 200px); max-width: 100%; height: auto; }
.institution { display: block; margin-bottom: .75rem; color: #cbd9eb; font-size: .72rem; font-weight: 600; line-height: 1.6; letter-spacing: .08em; text-transform: uppercase; }
.identity-panel h1 { margin: 0 0 .75rem; color: white; font-family: inherit; font-size: clamp(2rem, 4vw, 3rem); font-weight: 800; }
.identity-panel p { margin: 0; color: #dbe5f1; line-height: 1.6; }
.career-name { color: #f5a623; font-size: .75rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.login-panel { width: 100%; min-width: 0; }
.login-card {
  width: 100%;
  margin: 0;
  padding: clamp(1.5rem, 3vw, 2.5rem);
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--paper);
  box-shadow: 0 16px 40px rgba(0, 0, 0, .12);
}
.access-label { display: block; margin-bottom: .75rem; color: var(--green); font-size: .72rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.login-card h2 { margin: 0 0 .75rem; font-family: inherit; font-size: clamp(1.4rem, 3vw, 1.75rem); line-height: 1.25; }
.muted { margin: 0; line-height: 1.6; }
.login-card form { display: grid; gap: 1.25rem; margin-top: 1.75rem; }
.login-card label { color: var(--ink); }
.login-card input { min-width: 0; min-height: 48px; border-radius: 6px; }
.login-card .button.primary { min-height: 48px; border-radius: 6px; background: #f5a623; color: #0c2340; }
.login-card .button.primary:hover:not(:disabled) { background: #e0941a; }
.alert { margin: 0; line-height: 1.6; overflow-wrap: anywhere; }
.alert.success { margin-top: 1.75rem; }
.development-reset-link { display: grid; gap: .45rem; margin-top: 1rem; padding: .85rem; border: 1px dashed var(--green); border-radius: 6px; line-height: 1.5; overflow-wrap: anywhere; }
.back-link { display: block; margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid var(--line); text-align: center; line-height: 1.5; }
.back-link:focus-visible { outline: 2px solid var(--green); outline-offset: 4px; }
@media (max-width: 800px) {
  .login-shell { grid-template-columns: minmax(0, 460px); align-content: center; gap: 2rem; }
  .identity-panel { flex-direction: row; text-align: left; gap: 1rem; }
  .career-logo { width: 80px; flex-shrink: 0; }
  .identity-panel h1 { margin: 0; font-size: 2rem; }
  .institution { font-size: .65rem; margin-bottom: .4rem; }
  .identity-panel p, .career-name { display: none; }
}
@media (max-width: 400px) {
  .login-shell { padding: 1rem; gap: 1.5rem; }
  .career-logo { width: 60px; }
  .identity-panel h1 { font-size: 1.75rem; }
  .login-card { padding: 1.25rem; }
}
</style>
