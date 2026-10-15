<script setup lang="ts">
import { EyeIcon, EyeOffIcon, LoaderCircleIcon } from '@lucide/vue';
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { api, ApiError } from '../api';
import PageLoader from './PageLoader.vue';

const stages = [
  { key: 'aiUsage', title: 'Evaluación del uso de IA', description: 'Cómo debe analizar el uso de IA del estudiante.', file: 'uso-de-ia.txt' },
  { key: 'suggestedGrade', title: 'Calcular posible nota', description: 'Cómo debe valorar los criterios de la rúbrica para proponer la nota.', file: 'posible-nota.txt' },
  { key: 'feedback', title: 'Comentarios: qué hizo bien y qué hizo mal', description: 'Cómo debe explicar los aciertos, los errores y las mejoras.', file: 'aciertos-y-mejoras.txt' },
  { key: 'understanding', title: 'Comentarios: comprensión del tema', description: 'Cómo debe evaluar y comentar la comprensión del estudiante.', file: 'comprension-del-tema.txt' },
  { key: 'indicators', title: 'Indicadores: pensamiento crítico, autonomía y autenticidad', description: 'Qué evidencia debe considerar y cómo debe interpretar estos aspectos.', file: 'indicadores.txt' },
] as const;
type StageKey = typeof stages[number]['key'];
type Settings = {
  model: string;
  instructions: string;
  stageInstructions: Record<StageKey, string>;
  effectiveModel: string;
  enabled: boolean;
  providerConfigured: boolean;
  apiKeyConfigured: boolean;
  apiKeySource: 'admin' | 'server' | 'none';
  vercelSyncConfigured: boolean;
  vercelSync?: { status: 'not_configured' | 'env_update_failed' | 'redeploy_failed' | 'redeploy_requested'; message: string };
};

const settings = ref<Settings | null>(null);
const form = reactive({ model: 'default', enabled: true, instructions: '', stageInstructions: { aiUsage: '', suggestedGrade: '', feedback: '', understanding: '', indicators: '' } });
const loading = ref(true);
const saving = ref(false);
const error = ref('');
const message = ref('');
const apiKey = ref('');
const activeApiKey = ref('');
const keyRevealing = ref(false);
const revealError = ref('');
let revealController: AbortController | undefined;
const keyOperation = ref<'save' | 'retry' | null>(null);
const keySaving = computed(() => keyOperation.value !== null);
const importingStage = ref<StageKey | null>(null);
const busy = computed(() => saving.value || keySaving.value || keyRevealing.value || importingStage.value !== null);
const keyError = ref('');
const keyMessage = ref('');
const keyRetryNeeded = ref(false);
let keyMessageTimer: ReturnType<typeof setTimeout> | undefined;
const dirty = computed(() => settings.value && (
  form.model !== settings.value.model || form.enabled !== settings.value.enabled || form.instructions !== settings.value.instructions ||
  stages.some((stage) => form.stageInstructions[stage.key] !== settings.value!.stageInstructions[stage.key])
));

function setForm(value: Settings) {
  form.model = 'default';
  form.enabled = value.enabled;
  form.instructions = value.instructions;
  form.stageInstructions = { ...value.stageInstructions };
}

async function load() {
  if (busy.value) return;
  hideActiveApiKey();
  loading.value = true;
  error.value = '';
  try {
    settings.value = await api<Settings>('/admin/ai-engine');
    setForm(settings.value);
  } catch {
    error.value = 'No se pudo cargar la configuración. Inténtalo de nuevo.';
  } finally {
    loading.value = false;
  }
}

async function importFile(event: Event, key: StageKey) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file || busy.value) return;
  importingStage.value = key;
  error.value = '';
  message.value = '';
  try {
    if (!/\.txt$/i.test(file.name)) throw new Error('Selecciona un archivo .txt de texto plano');
    if (file.size > 20_000) throw new Error('El archivo es demasiado grande');
    const text = await file.text().catch(() => { throw new Error('No se pudo leer el archivo. Inténtalo de nuevo.'); });
    const content = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
    if (!content.trim() || content.includes('\u0000')) throw new Error('El archivo debe contener instrucciones en texto plano');
    if (content.length > 5_000) throw new Error('Cada punto admite hasta 5000 caracteres');
    form.stageInstructions[key] = content;
    message.value = 'Instrucciones cargadas para este punto. Guarda para aplicarlas.';
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo leer el archivo';
  } finally {
    input.value = '';
    importingStage.value = null;
  }
}

function download(stage: typeof stages[number]) {
  if (busy.value) return;
  error.value = '';
  try {
    const url = URL.createObjectURL(new Blob([form.stageInstructions[stage.key]], { type: 'text/plain;charset=utf-8' }));
    try {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = stage.file;
      anchor.click();
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  } catch {
    error.value = 'No se pudo descargar el archivo. Inténtalo de nuevo.';
  }
}

async function save() {
  if (busy.value) return;
  saving.value = true;
  error.value = '';
  message.value = '';
  try {
    settings.value = await api<Settings>('/admin/ai-engine/instructions', {
      method: 'PUT', body: JSON.stringify(form),
    });
    setForm(settings.value);
    message.value = 'Instrucciones guardadas correctamente.';
  } catch {
    error.value = 'No se pudieron guardar las instrucciones. Inténtalo de nuevo.';
  } finally {
    saving.value = false;
  }
}

async function saveApiKey() {
  if (busy.value || !apiKey.value.trim()) return;
  clearKeyFeedback();
  if (!/^[\x21-\x7e]{20,4096}$/.test(apiKey.value.trim())) {
    keyError.value = 'Escribe una API key de entre 20 y 4096 caracteres, sin espacios ni saltos de línea.';
    return;
  }
  hideActiveApiKey();
  keyOperation.value = 'save';
  try {
    settings.value = await api<Settings>('/admin/ai-engine/api-key', {
      method: 'PUT', body: JSON.stringify({ apiKey: apiKey.value.trim() }),
    });
    apiKey.value = '';
    showSyncResult(settings.value);
  } catch (cause) {
    keyError.value = cause instanceof ApiError && cause.status === 400
      ? `${cause.message} No se cambió la clave actual.`
      : cause instanceof ApiError && cause.status === 503
        ? 'No se pudo verificar la API key. No se cambió la clave actual; inténtalo de nuevo.'
        : 'No se pudo completar el guardado de la API key. Inténtalo de nuevo.';
  } finally {
    keyOperation.value = null;
  }
}

function hideActiveApiKey() {
  revealController?.abort();
  activeApiKey.value = '';
  revealError.value = '';
}

async function toggleActiveApiKey() {
  if (busy.value) return;
  if (activeApiKey.value) {
    hideActiveApiKey();
    return;
  }
  revealError.value = '';
  keyRevealing.value = true;
  const controller = new AbortController();
  revealController = controller;
  try {
    const value = await api<{ apiKey: string }>('/admin/ai-engine/api-key', { cache: 'no-store', signal: controller.signal });
    if (controller.signal.aborted) return;
    if (typeof value.apiKey !== 'string' || !value.apiKey) {
      revealError.value = 'No hay una API key configurada.';
      return;
    }
    activeApiKey.value = value.apiKey;
  } catch {
    if (!controller.signal.aborted) revealError.value = 'No se pudo mostrar la API key en uso. Inténtalo de nuevo.';
  } finally {
    if (revealController === controller) revealController = undefined;
    keyRevealing.value = false;
  }
}

function clearKeyFeedback() {
  clearTimeout(keyMessageTimer);
  keyError.value = '';
  keyMessage.value = '';
  keyRetryNeeded.value = false;
}

function showKeySuccess(text: string) {
  clearKeyFeedback();
  keyMessage.value = text;
  keyMessageTimer = setTimeout(() => { keyMessage.value = ''; }, 4_000);
}

function showSyncResult(value: Settings) {
  if (value.vercelSync?.status === 'redeploy_requested') {
    showKeySuccess('API key guardada correctamente.');
    return;
  }
  keyRetryNeeded.value = value.vercelSyncConfigured && value.apiKeySource === 'admin';
  keyError.value = value.vercelSync?.status === 'not_configured'
    ? 'La clave se guardó, pero la actualización automática no está disponible. Revisa la configuración del servicio.'
    : 'La clave se guardó, pero la actualización automática quedó pendiente. Reintenta la actualización.';
}

async function retryVercelSync() {
  if (busy.value || !keyRetryNeeded.value) return;
  keyOperation.value = 'retry';
  clearTimeout(keyMessageTimer);
  keyMessage.value = '';
  try {
    settings.value = await api<Settings>('/admin/ai-engine/api-key/sync', { method: 'POST' });
    showSyncResult(settings.value);
  } catch (cause) {
    keyError.value = cause instanceof ApiError && cause.status === 400
      ? cause.message
      : 'No se pudo completar la actualización automática. Inténtalo de nuevo.';
  } finally {
    keyOperation.value = null;
  }
}

onMounted(load);
onBeforeUnmount(() => {
  clearTimeout(keyMessageTimer);
  hideActiveApiKey();
});
</script>

<template>
  <section class="section-block ai-settings" aria-labelledby="ai-settings-title">
    <span class="eyebrow">Actividades</span>
    <h2 id="ai-settings-title">Comportamiento del motor de IA</h2>
    <p>Define cómo debe comportarse la IA en cada uno de los cinco puntos. Escribe las instrucciones en texto plano o carga un archivo .txt para ese punto.</p>
    <PageLoader
      v-if="loading"
      compact
      label="Cargando configuración del motor…"
    />
    <form v-if="!loading && settings" class="panel ai-form ai-key-form" :aria-busy="keySaving || keyRevealing" @submit.prevent="saveApiKey">
      <h3>API key del motor de IA</h3>
      <p>Clave actual: <strong>{{ settings.apiKeySource === 'admin' ? 'Configurada desde el panel' : settings.apiKeySource === 'server' ? 'Configurada en el servidor' : 'Sin configurar' }}</strong></p>
      <div v-if="settings.apiKeyConfigured" class="ai-current-key">
        <label for="ai-active-api-key">API key en uso
          <input id="ai-active-api-key" :value="activeApiKey || '••••••••••••••••'" :type="activeApiKey ? 'text' : 'password'" readonly autocomplete="off" spellcheck="false" autocapitalize="off" />
        </label>
        <button class="button secondary ai-reveal-key" type="button" :disabled="busy" :aria-busy="keyRevealing" :aria-expanded="Boolean(activeApiKey)" :aria-label="activeApiKey ? 'Ocultar API key en uso' : 'Mostrar API key en uso'" aria-controls="ai-active-api-key" @click="toggleActiveApiKey">
          <LoaderCircleIcon v-if="keyRevealing" class="ui-icon icon-spin" aria-hidden="true" />
          <EyeOffIcon v-else-if="activeApiKey" class="ui-icon" aria-hidden="true" />
          <EyeIcon v-else class="ui-icon" aria-hidden="true" />
          {{ keyRevealing ? 'Cargando clave…' : activeApiKey ? 'Ocultar' : 'Mostrar' }}
        </button>
      </div>
      <p v-if="revealError" class="alert error" role="alert">{{ revealError }}</p>
      <label for="ai-api-key">Nueva API key
        <input id="ai-api-key" v-model="apiKey" type="password" autocomplete="new-password" spellcheck="false" autocapitalize="off" minlength="20" maxlength="4096" required :disabled="busy" aria-describedby="ai-api-key-help" @input="clearKeyFeedback" />
      </label>
      <small id="ai-api-key-help">Mínimo 20 caracteres. Verificaremos la clave antes de aplicarla. Puedes consultar la clave actual con Mostrar. Cambiarla no modifica las instrucciones de los cinco puntos.</small>
      <div class="ai-actions">
        <button class="button primary" type="submit" :disabled="busy || apiKey.trim().length < 20" :aria-busy="keyOperation === 'save'">
          <LoaderCircleIcon v-if="keyOperation === 'save'" class="ui-icon icon-spin" aria-hidden="true" />
          {{ keyOperation === 'save' ? 'Verificando y guardando…' : 'Guardar API key' }}
        </button>
      </div>
      <div v-if="keyError" class="alert error ai-key-error" role="alert">
        <p>{{ keyError }}</p>
        <button v-if="keyRetryNeeded" class="button secondary" type="button" :disabled="busy" :aria-busy="keyOperation === 'retry'" @click="retryVercelSync">
          <LoaderCircleIcon v-if="keyOperation === 'retry'" class="ui-icon icon-spin" aria-hidden="true" />
          {{ keyOperation === 'retry' ? 'Actualizando…' : 'Reintentar actualización' }}
        </button>
      </div>
      <p v-if="keyMessage" class="alert success" role="status" aria-live="polite">{{ keyMessage }}</p>
    </form>
    <form v-if="!loading && settings" class="panel ai-form ai-instructions-form" :aria-busy="saving || importingStage !== null" @submit.prevent="save">
      <p v-if="!settings.providerConfigured" class="alert warning">Configura la API key en este panel y la URL del proveedor en el servidor para usar el motor de IA.</p>
      <fieldset v-for="(stage, index) in stages" :key="stage.key" class="panel ai-stage" :disabled="busy" :aria-busy="importingStage === stage.key" :data-stage="stage.key">
        <legend>{{ index + 1 }}. {{ stage.title }}</legend>
        <p>{{ stage.description }}</p>
        <label :for="`instructions-${stage.key}`">Instrucciones de comportamiento</label>
        <textarea :id="`instructions-${stage.key}`" v-model="form.stageInstructions[stage.key]" rows="5" maxlength="5000" required :aria-describedby="`help-${stage.key}`" />
        <small :id="`help-${stage.key}`">{{ form.stageInstructions[stage.key].length }}/5000 caracteres · Texto plano</small>
        <div class="ai-file-actions">
          <label>Cargar instrucciones .txt<input type="file" accept=".txt,text/plain" @change="importFile($event, stage.key)" /></label>
          <button class="button secondary" type="button" @click="download(stage)">Descargar .txt</button>
        </div>
        <p v-if="importingStage === stage.key" class="ai-progress" role="status" aria-live="polite">
          <LoaderCircleIcon class="ui-icon icon-spin" aria-hidden="true" />
          Cargando archivo…
        </p>
      </fieldset>
      <p class="muted">Las instrucciones complementan la rúbrica y las indicaciones del docente. La posible nota se calcula a partir de los niveles sugeridos por criterio. Los cambios afectan a futuros análisis.</p>
      <div class="ai-actions">
        <button class="button primary" type="submit" :disabled="busy || !dirty" :aria-busy="saving">
          <LoaderCircleIcon v-if="saving" class="ui-icon icon-spin" aria-hidden="true" />
          {{ saving ? 'Guardando instrucciones…' : 'Guardar instrucciones' }}
        </button>
      </div>
    </form>
    <p v-if="error" class="alert error" role="alert">{{ error }}</p>
    <button v-if="!loading && !settings" class="button secondary" type="button" @click="load">Reintentar</button>
    <p v-if="message" class="alert success" role="status">{{ message }}</p>
  </section>
</template>

<style scoped>
.ai-settings h2 { margin: .25rem 0; }
.ai-form { display: grid; gap: 1rem; }
.ai-form p { margin: 0; }
.ai-form label { display: grid; gap: .5rem; }
.ai-form textarea { width: 100%; min-width: 0; font-family: ui-monospace, monospace; line-height: 1.5; resize: vertical; }
.ai-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: .75rem; }
.ai-progress { display: flex; align-items: center; gap: .5rem; }
.ai-key-error { display: grid; gap: .75rem; }
.ai-current-key { display: flex; flex-wrap: wrap; align-items: flex-end; gap: .75rem; }
.ai-current-key label { flex: 1 1 16rem; min-width: 0; }
.ai-stage { display: grid; gap: 1rem; min-width: 0; }
.ai-stage legend { padding: 0 .5rem; font-weight: 700; }
.ai-file-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .75rem; }
.ai-file-actions input { max-width: 100%; }
</style>
