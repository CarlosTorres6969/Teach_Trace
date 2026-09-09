<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import {
  accessibilitySettings,
  applyAccessibilitySettings,
  DEFAULT_ACCESSIBILITY_SETTINGS,
  systemPrefersReducedMotion,
} from '../accessibility';
import { api } from '../api';
import { auth } from '../auth';
import type { AccessibilitySettings } from '../types';

function copySettings(settings: AccessibilitySettings): AccessibilitySettings {
  return { ...settings };
}

const initial = auth.user?.accessibilitySettings ?? accessibilitySettings.value;
const draft = reactive<AccessibilitySettings>(copySettings(initial));
const saved = ref<AccessibilitySettings>(copySettings(initial));
const saving = ref(false);
const error = ref('');
const toast = ref('');
let toastTimer: ReturnType<typeof setTimeout> | undefined;

const effectiveMotionLabel = computed(() =>
  draft.reducedMotion || systemPrefersReducedMotion.value
    ? 'Las animaciones están reducidas.'
    : 'Las animaciones se muestran normalmente.',
);

watch(
  draft,
  (settings) => applyAccessibilitySettings(copySettings(settings), false),
  { deep: true, immediate: true },
);

function restoreDefaults() {
  Object.assign(draft, DEFAULT_ACCESSIBILITY_SETTINGS);
}

async function saveSettings() {
  saving.value = true;
  error.value = '';
  toast.value = '';
  try {
    const result = await api<{ accessibilitySettings: AccessibilitySettings }>(
      '/users/me/preferences',
      {
        method: 'PATCH',
        body: JSON.stringify({ accessibilitySettings: copySettings(draft) }),
      },
    );
    const stored = copySettings(result.accessibilitySettings);
    saved.value = stored;
    Object.assign(draft, stored);
    if (auth.user) auth.user.accessibilitySettings = stored;
    applyAccessibilitySettings(stored);
    toast.value = 'Configuración de accesibilidad guardada.';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.value = '';
    }, 3500);
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'No se pudo guardar la configuración';
  } finally {
    saving.value = false;
  }
}

onBeforeUnmount(() => {
  if (toastTimer) clearTimeout(toastTimer);
  applyAccessibilitySettings(saved.value, false);
});
</script>

<template>
  <main class="page narrow accessibility-settings">
    <RouterLink class="back-link" to="/student">← Volver al panel</RouterLink>

    <section class="page-heading compact">
      <div>
        <span class="eyebrow">Configuración personal</span>
        <h1>Accesibilidad</h1>
      </div>
      <p>Ajusta la presentación de toda la plataforma según tus necesidades.</p>
    </section>

    <form class="accessibility-layout" @submit.prevent="saveSettings">
      <section class="panel accessibility-controls" aria-labelledby="visual-settings-title">
        <div>
          <span class="eyebrow">Preferencias visuales</span>
          <h2 id="visual-settings-title">Lectura y movimiento</h2>
        </div>

        <label class="font-size-control" for="font-size">
          <span>
            Tamaño del texto
            <output for="font-size">{{ draft.fontSize }} %</output>
          </span>
          <input
            id="font-size"
            v-model.number="draft.fontSize"
            type="range"
            min="100"
            max="150"
            step="5"
          />
          <span class="range-labels" aria-hidden="true">
            <small>100 %</small>
            <small>150 %</small>
          </span>
        </label>

        <label class="accessibility-option">
          <input v-model="draft.highContrast" type="checkbox" />
          <span>
            <strong>Alto contraste</strong>
            <small>Usa una paleta con contraste de texto WCAG AAA.</small>
          </span>
        </label>

        <label class="accessibility-option">
          <input v-model="draft.reducedMotion" type="checkbox" />
          <span>
            <strong>Animaciones reducidas</strong>
            <small>{{ effectiveMotionLabel }}</small>
            <small v-if="systemPrefersReducedMotion">
              Tu sistema operativo solicita movimiento reducido.
            </small>
          </span>
        </label>

        <p v-if="error" class="alert error" role="alert">{{ error }}</p>

        <div class="accessibility-actions">
          <button class="button secondary" type="button" @click="restoreDefaults">
            Restaurar valores
          </button>
          <button class="button primary" type="submit" :disabled="saving">
            {{ saving ? 'Guardando…' : 'Guardar configuración' }}
          </button>
        </div>
      </section>

      <aside class="panel accessibility-preview" aria-live="polite">
        <span class="eyebrow">Vista previa en tiempo real</span>
        <h2>Aprender con claridad</h2>
        <p>
          Este texto cambia mientras ajustas el control. La configuración se aplicará a todas las
          clases, actividades, mensajes y resultados de TeachTrace.
        </p>
        <a href="#preview" @click.prevent>Enlace de ejemplo</a>
        <button class="button primary" type="button">Botón de ejemplo</button>
      </aside>
    </form>

    <div v-if="toast" class="toast" role="status" aria-live="polite">{{ toast }}</div>
  </main>
</template>
