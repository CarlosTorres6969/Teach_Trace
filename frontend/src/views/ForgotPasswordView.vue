<script setup lang="ts">
import { reactive, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { api } from '../api';

const form = reactive({ email: '' });
const loading = ref(false);
const submitted = ref(false);
const error = ref('');

async function requestReset() {
  error.value = '';
  loading.value = true;
  try {
    await api('/auth/password-reset/request', { method: 'POST', body: JSON.stringify(form) });
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
