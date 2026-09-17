<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { api } from '../api';

const route = useRoute();
const router = useRouter();
const token = computed(() => typeof route.query.token === 'string' ? route.query.token : '');
const form = reactive({ password: '', confirmPassword: '' });
const loading = ref(false);
const completed = ref(false);
const error = ref('');

async function resetPassword() {
  error.value = '';
  if (!token.value) {
    error.value = 'El enlace de recuperación no contiene un token válido.';
    return;
  }
  if (form.password !== form.confirmPassword) {
    error.value = 'Las contraseñas no coinciden.';
    return;
  }
  loading.value = true;
  try {
    await api('/auth/password-reset/confirm', { method: 'POST', body: JSON.stringify({ token: token.value, password: form.password }) });
    completed.value = true;
    window.setTimeout(() => { void router.push('/login'); }, 1800);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'El enlace no es válido o ya expiró';
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
        <p>Define una nueva contraseña para continuar.</p>
      </div>
      <span class="career-name">Ingeniería en Sistemas</span>
    </section>
    <section class="login-panel" aria-label="Nueva contraseña">
      <div class="login-card">
        <span class="access-label">Seguridad de la cuenta</span>
        <h2>Nueva contraseña</h2>
        <p class="muted">Usa al menos 8 caracteres. El enlace solo puede utilizarse una vez.</p>
        <div v-if="completed" class="alert success">Contraseña actualizada. Te enviaremos al inicio de sesión.</div>
        <form v-else @submit.prevent="resetPassword">
          <label>Nueva contraseña<input v-model="form.password" type="password" autocomplete="new-password" minlength="8" maxlength="128" required /></label>
          <label>Confirmar contraseña<input v-model="form.confirmPassword" type="password" autocomplete="new-password" minlength="8" maxlength="128" required /></label>
          <p v-if="error" class="alert error">{{ error }}</p>
          <button class="button primary full" :disabled="loading">{{ loading ? 'Actualizando…' : 'Cambiar contraseña' }}</button>
        </form>
        <RouterLink class="back-link" to="/login">Volver a iniciar sesión</RouterLink>
      </div>
    </section>
  </main>
</template>
