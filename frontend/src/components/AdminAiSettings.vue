<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api } from '../api';

type Settings = {
  markdown: string;
  effectiveModel: string;
  enabled: boolean;
  providerConfigured: boolean;
};

const settings = ref<Settings | null>(null);
const markdown = ref('');
const loading = ref(true);
const saving = ref(false);
const error = ref('');
const message = ref('');

async function load() {
  loading.value = true;
  error.value = '';
  try {
    settings.value = await api<Settings>('/admin/ai-engine');
    markdown.value = settings.value.markdown;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo cargar la configuración';
  } finally {
    loading.value = false;
  }
}

async function importFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  error.value = '';
  message.value = '';
  try {
    if (!/\.md$/i.test(file.name)) throw new Error('Selecciona un archivo .md');
    if (file.size > 80_000) throw new Error('El archivo es demasiado grande');
    const content = await file.text();
    if (content.length > 20_000) throw new Error('El archivo debe tener como máximo 20000 caracteres');
    markdown.value = content;
    message.value = 'Archivo cargado en el editor. Guarda para aplicar los cambios.';
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo leer el archivo';
  } finally {
    input.value = '';
  }
}

function download() {
  const url = URL.createObjectURL(new Blob([markdown.value], { type: 'text/markdown;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'motor-ia-actividades.md';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function save() {
  saving.value = true;
  error.value = '';
  message.value = '';
  try {
    settings.value = await api<Settings>('/admin/ai-engine', {
      method: 'PUT', body: JSON.stringify({ markdown: markdown.value }),
    });
    message.value = 'Configuración guardada. Se aplicará a los próximos análisis de actividades.';
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo guardar la configuración';
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section class="section-block ai-settings" aria-labelledby="ai-settings-title">
    <span class="eyebrow">Actividades</span>
    <h2 id="ai-settings-title">Motor de IA</h2>
    <p>Controla el modelo y las instrucciones generales del análisis de actividades mediante un archivo Markdown.</p>
    <p v-if="loading" role="status">Cargando configuración…</p>
    <form v-else-if="settings" class="panel ai-form" @submit.prevent="save">
      <p class="ai-status">
        Estado guardado: <strong>{{ settings.enabled ? 'Activado' : 'Desactivado' }}</strong>
        · Modelo: <strong>{{ settings.effectiveModel || 'Sin configurar' }}</strong>
      </p>
      <p v-if="!settings.providerConfigured" class="alert warning">El proveedor de IA necesita su URL y clave de acceso en la configuración del servidor.</p>
      <p>En el bloque inicial usa <code>model: default</code> para conservar el modelo del servidor, o escribe el identificador de un modelo compatible con tu proveedor. Usa <code>enabled: true</code> o <code>enabled: false</code>. Después del bloque escribe las instrucciones.</p>
      <label>
        Cargar archivo .md
        <input type="file" accept=".md,text/markdown" :disabled="saving" @change="importFile" />
      </label>
      <label>
        Configuración e instrucciones
        <textarea v-model="markdown" rows="14" maxlength="20000" spellcheck="false" :disabled="saving" required aria-describedby="ai-markdown-help" />
      </label>
      <small id="ai-markdown-help">{{ markdown.length }}/20000 caracteres. Las instrucciones complementan la rúbrica y las indicaciones del docente. Los cambios se aplican a futuros análisis.</small>
      <div class="ai-actions">
        <button class="button secondary" type="button" :disabled="saving" @click="download">Descargar .md</button>
        <button class="button primary" type="submit" :disabled="saving || markdown === settings.markdown">{{ saving ? 'Guardando…' : 'Guardar configuración' }}</button>
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
</style>
