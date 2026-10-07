<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { api } from '../api';

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
const keySaving = ref(false);
const keyError = ref('');
const keyMessage = ref('');
const keyWarning = ref('');
const dirty = computed(() => settings.value && (
  form.model !== settings.value.model || form.enabled !== settings.value.enabled || form.instructions !== settings.value.instructions ||
  stages.some((stage) => form.stageInstructions[stage.key] !== settings.value!.stageInstructions[stage.key])
));

function setForm(value: Settings) {
  form.model = value.model;
  form.enabled = value.enabled;
  form.instructions = value.instructions;
  form.stageInstructions = { ...value.stageInstructions };
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    settings.value = await api<Settings>('/admin/ai-engine');
    setForm(settings.value);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo cargar la configuración';
  } finally {
    loading.value = false;
  }
}

async function importFile(event: Event, key: StageKey) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  error.value = '';
  message.value = '';
  try {
    if (!/\.txt$/i.test(file.name)) throw new Error('Selecciona un archivo .txt de texto plano');
    if (file.size > 20_000) throw new Error('El archivo es demasiado grande');
    const content = (await file.text()).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
    if (!content.trim() || content.includes('\u0000')) throw new Error('El archivo debe contener instrucciones en texto plano');
    if (content.length > 5_000) throw new Error('Cada punto admite hasta 5000 caracteres');
    form.stageInstructions[key] = content;
    message.value = 'Instrucciones cargadas para este punto. Guarda para aplicarlas.';
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo leer el archivo';
  } finally {
    input.value = '';
  }
}

function download(stage: typeof stages[number]) {
  const url = URL.createObjectURL(new Blob([form.stageInstructions[stage.key]], { type: 'text/plain;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = stage.file;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function save() {
  saving.value = true;
  error.value = '';
  message.value = '';
  try {
    settings.value = await api<Settings>('/admin/ai-engine/instructions', {
      method: 'PUT', body: JSON.stringify(form),
    });
    setForm(settings.value);
    message.value = 'Comportamiento de los cinco puntos guardado. Se aplicará a los próximos análisis de actividades.';
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo guardar la configuración';
  } finally {
    saving.value = false;
  }
}

async function saveApiKey() {
  keySaving.value = true;
  keyError.value = '';
  keyMessage.value = '';
  keyWarning.value = '';
  try {
    settings.value = await api<Settings>('/admin/ai-engine/api-key', {
      method: 'PUT', body: JSON.stringify({ apiKey: apiKey.value.trim() }),
    });
    apiKey.value = '';
    showSyncResult(settings.value);
  } catch (cause) {
    keyError.value = cause instanceof Error ? cause.message : 'No se pudo actualizar la API key';
  } finally {
    keySaving.value = false;
  }
}

function showSyncResult(value: Settings) {
  if (value.vercelSync?.status === 'redeploy_requested') keyMessage.value = value.vercelSync.message;
  else keyWarning.value = value.vercelSync?.message ?? 'API key guardada en la aplicación. No se pudo confirmar su sincronización con Vercel.';
}

async function retryVercelSync() {
  keySaving.value = true;
  keyError.value = '';
  keyMessage.value = '';
  keyWarning.value = '';
  try {
    settings.value = await api<Settings>('/admin/ai-engine/api-key/sync', { method: 'POST' });
    showSyncResult(settings.value);
  } catch (cause) {
    keyError.value = cause instanceof Error ? cause.message : 'No se pudo sincronizar con Vercel';
  } finally {
    keySaving.value = false;
  }
}

async function restoreServerApiKey() {
  keySaving.value = true;
  keyError.value = '';
  keyMessage.value = '';
  keyWarning.value = '';
  try {
    settings.value = await api<Settings>('/admin/ai-engine/api-key', { method: 'DELETE' });
    apiKey.value = '';
    keyMessage.value = settings.value.apiKeyConfigured
      ? 'Se usará la API key del servidor en los próximos análisis.'
      : 'Clave del panel retirada. Configura una API key para activar el proveedor de IA.';
  } catch (cause) {
    keyError.value = cause instanceof Error ? cause.message : 'No se pudo restaurar la clave del servidor';
  } finally {
    keySaving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section class="section-block ai-settings" aria-labelledby="ai-settings-title">
    <span class="eyebrow">Actividades</span>
    <h2 id="ai-settings-title">Comportamiento del motor de IA</h2>
    <p>Define cómo debe comportarse la IA en cada uno de los cinco puntos. Escribe las instrucciones en texto plano o carga un archivo .txt para ese punto.</p>
    <p v-if="loading" role="status">Cargando configuración…</p>
    <form v-if="!loading && settings" class="panel ai-form ai-key-form" @submit.prevent="saveApiKey">
      <h3>API key del motor de IA</h3>
      <p>Clave actual: <strong>{{ settings.apiKeySource === 'admin' ? 'Configurada desde el panel' : settings.apiKeySource === 'server' ? 'Configurada en el servidor' : 'Sin configurar' }}</strong></p>
      <label for="ai-api-key">Nueva API key
        <input id="ai-api-key" v-model="apiKey" type="password" autocomplete="new-password" spellcheck="false" autocapitalize="off" maxlength="4096" required :disabled="keySaving || saving" aria-describedby="ai-api-key-help" />
      </label>
      <small id="ai-api-key-help">La clave guardada permanece oculta. Cambiarla no modifica las instrucciones de los cinco puntos.</small>
      <p v-if="settings.vercelSyncConfigured">Al guardar, AI_API_KEY se actualizará en Vercel y se solicitará un nuevo despliegue del backend automáticamente.</p>
      <p v-else class="alert warning">La sincronización automática con Vercel aún necesita configurarse en el servidor. Las claves guardadas aquí se aplican a la aplicación.</p>
      <div class="ai-actions">
        <button v-if="settings.apiKeySource === 'admin' && settings.vercelSyncConfigured" class="button secondary" type="button" :disabled="keySaving || saving" @click="retryVercelSync">Reintentar sincronización con Vercel</button>
        <button v-if="settings.apiKeySource === 'admin'" class="button secondary" type="button" :disabled="keySaving || saving" @click="restoreServerApiKey">Usar clave del servidor</button>
        <button class="button primary" type="submit" :disabled="keySaving || saving || !apiKey.trim()">{{ keySaving ? 'Guardando…' : 'Guardar API key' }}</button>
      </div>
      <p v-if="keyError" class="alert error" role="alert">{{ keyError }}</p>
      <p v-if="keyMessage" class="alert success" role="status">{{ keyMessage }}</p>
      <p v-if="keyWarning" class="alert warning" role="status">{{ keyWarning }}</p>
    </form>
    <form v-if="!loading && settings" class="panel ai-form ai-instructions-form" @submit.prevent="save">
      <p class="ai-status">
        Estado guardado: <strong>{{ settings.enabled ? 'Activado' : 'Desactivado' }}</strong>
        · Modelo: <strong>{{ settings.effectiveModel || 'Sin configurar' }}</strong>
      </p>
      <p v-if="!settings.providerConfigured" class="alert warning">Configura la API key en este panel y la URL del proveedor en el servidor para usar el motor de IA.</p>
      <label>Modelo de IA<input v-model.trim="form.model" type="text" maxlength="200" required :disabled="saving || keySaving" aria-describedby="ai-model-help" /></label>
      <small id="ai-model-help">Usa default para el modelo del servidor, o el identificador de un modelo compatible con tu proveedor.</small>
      <label class="ai-toggle"><input v-model="form.enabled" type="checkbox" :disabled="saving || keySaving" /> Activar análisis de IA para las actividades</label>
      <details>
        <summary>Instrucciones generales</summary>
        <label>Se aplican a todos los puntos<textarea v-model="form.instructions" rows="4" maxlength="19500" :disabled="saving || keySaving" required /></label>
      </details>
      <fieldset v-for="(stage, index) in stages" :key="stage.key" class="panel ai-stage" :disabled="saving || keySaving" :data-stage="stage.key">
        <legend>{{ index + 1 }}. {{ stage.title }}</legend>
        <p>{{ stage.description }}</p>
        <label :for="`instructions-${stage.key}`">Instrucciones de comportamiento</label>
        <textarea :id="`instructions-${stage.key}`" v-model="form.stageInstructions[stage.key]" rows="5" maxlength="5000" required :aria-describedby="`help-${stage.key}`" />
        <small :id="`help-${stage.key}`">{{ form.stageInstructions[stage.key].length }}/5000 caracteres · Texto plano</small>
        <div class="ai-file-actions">
          <label>Cargar instrucciones .txt<input type="file" accept=".txt,text/plain" @change="importFile($event, stage.key)" /></label>
          <button class="button secondary" type="button" @click="download(stage)">Descargar .txt</button>
        </div>
      </fieldset>
      <p class="muted">Las instrucciones complementan la rúbrica y las indicaciones del docente. La posible nota se calcula a partir de los niveles sugeridos por criterio. Los cambios afectan a futuros análisis.</p>
      <div class="ai-actions">
        <button class="button primary" type="submit" :disabled="saving || keySaving || !dirty">{{ saving ? 'Guardando…' : 'Guardar instrucciones' }}</button>
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
.ai-status { overflow-wrap: anywhere; }
.ai-stage { display: grid; gap: 1rem; min-width: 0; }
.ai-stage legend { padding: 0 .5rem; font-weight: 700; }
.ai-toggle { display: flex !important; align-items: center; }
.ai-toggle input { width: auto; }
.ai-file-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .75rem; }
.ai-file-actions input { max-width: 100%; }
summary { cursor: pointer; margin-bottom: .75rem; }
</style>
