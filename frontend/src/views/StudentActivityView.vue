<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../api';

const route = useRoute();
const activityId = Number(route.params.id);
const tab = ref<'logbook' | 'ai' | 'submission'>('logbook');
const title = ref('Actividad');
const loading = ref(true);
const message = ref('');
const error = ref('');

const logbook = reactive({ initialIdeas: '', prompts: '', validationsAndDecisions: '', finalReflection: '' });
const declaration = reactive({ toolName: '', usageLevel: 1, purpose: '', promptSummary: '' });
const submission = reactive({ status: 'not_submitted', submittedAt: '', productText: '', productUrl: '' });

const statusText = computed(() => ({
  not_submitted: 'Sin entregar', submitted: 'Entregado', under_review: 'En revisión', evaluated: 'Evaluado',
}[submission.status] ?? submission.status));

async function load() {
  try {
    const [logbookData, declarationData, submissionData] = await Promise.all([
      api<Record<string, string> & { activity: { title: string } }>(`/student/activities/${activityId}/logbook`),
      api<Record<string, string | number>>(`/student/activities/${activityId}/ai-declaration`),
      api<Record<string, string> & { activity: { title: string } }>(`/student/activities/${activityId}/submission-status`),
    ]);
    title.value = logbookData.activity.title;
    Object.assign(logbook, logbookData);
    Object.assign(declaration, declarationData);
    Object.assign(submission, submissionData);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo cargar la actividad';
  } finally {
    loading.value = false;
  }
}

async function saveLogbook() {
  await runSave('Bitácora actualizada', `/student/activities/${activityId}/logbook`, logbook);
}

async function saveDeclaration() {
  await runSave('Declaración de IA guardada', `/student/activities/${activityId}/ai-declaration`, declaration);
}

async function submitProduct() {
  if (!submission.productText.trim() && !submission.productUrl.trim()) {
    error.value = 'Escribe el producto o agrega un enlace antes de entregar.';
    return;
  }
  const result = await runSave<Record<string, string>>(
    'Producto entregado correctamente',
    `/student/activities/${activityId}/submission`,
    { productText: submission.productText, productUrl: submission.productUrl },
  );
  if (result) Object.assign(submission, result);
}

async function runSave<T = unknown>(success: string, path: string, data: object): Promise<T | null> {
  message.value = '';
  error.value = '';
  try {
    const result = await api<T>(path, { method: 'PUT', body: JSON.stringify(data) });
    message.value = success;
    return result;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No fue posible guardar';
    return null;
  }
}

onMounted(load);
</script>

<template>
  <main class="page narrow">
    <RouterLink to="/student" class="back-link">← Mis actividades</RouterLink>
    <section class="page-heading compact"><div><span class="eyebrow">Actividad</span><h1>{{ title }}</h1></div></section>
    <p v-if="loading" class="muted">Cargando…</p>
    <template v-else>
      <nav class="tabs" aria-label="Secciones de la actividad">
        <button :class="{ active: tab === 'logbook' }" @click="tab = 'logbook'">Bitácora</button>
        <button :class="{ active: tab === 'ai' }" @click="tab = 'ai'">Declaración de IA</button>
        <button :class="{ active: tab === 'submission' }" @click="tab = 'submission'">Entrega</button>
      </nav>
      <p v-if="message" class="alert success">{{ message }}</p>
      <p v-if="error" class="alert error">{{ error }}</p>

      <form v-if="tab === 'logbook'" class="panel form-stack" @submit.prevent="saveLogbook">
        <div><h2>Bitácora del proceso</h2><p class="muted">Puedes regresar y actualizarla mientras desarrollas la actividad.</p></div>
        <label>Ideas iniciales<textarea v-model="logbook.initialIdeas" rows="4" maxlength="10000" /></label>
        <label>Prompts utilizados<textarea v-model="logbook.prompts" rows="5" maxlength="20000" /></label>
        <label>Validaciones y decisiones<textarea v-model="logbook.validationsAndDecisions" rows="5" maxlength="20000" /></label>
        <label>Reflexión final<textarea v-model="logbook.finalReflection" rows="5" maxlength="10000" /></label>
        <button class="button primary">Guardar bitácora</button>
      </form>

      <form v-else-if="tab === 'ai'" class="panel form-stack" @submit.prevent="saveDeclaration">
        <div><h2>Declaración de uso de IA</h2><p class="muted">Describe de forma transparente cómo apoyó tu proceso.</p></div>
        <label>Herramienta utilizada<input v-model="declaration.toolName" maxlength="120" required /></label>
        <label>Nivel declarado
          <select v-model.number="declaration.usageLevel">
            <option :value="1">Nivel 1 — apoyo mínimo</option><option :value="2">Nivel 2 — apoyo moderado</option><option :value="3">Nivel 3 — apoyo significativo</option>
          </select>
        </label>
        <label>Propósito<textarea v-model="declaration.purpose" rows="4" maxlength="5000" required /></label>
        <label>Resumen de prompts<textarea v-model="declaration.promptSummary" rows="5" maxlength="10000" required /></label>
        <button class="button primary">Guardar declaración</button>
      </form>

      <form v-else class="panel form-stack" @submit.prevent="submitProduct">
        <div class="card-topline"><div><h2>Producto final</h2><p class="muted">Entrega texto, un enlace o ambos.</p></div><span class="status" :data-status="submission.status">{{ statusText }}</span></div>
        <label>Contenido del producto<textarea v-model="submission.productText" rows="10" maxlength="50000" /></label>
        <label>Enlace complementario<input v-model="submission.productUrl" type="url" placeholder="https://…" maxlength="500" /></label>
        <p v-if="submission.submittedAt" class="muted">Última entrega: {{ new Date(submission.submittedAt).toLocaleString() }}</p>
        <button class="button primary">{{ submission.status === 'not_submitted' ? 'Entregar producto' : 'Actualizar entrega' }}</button>
      </form>
    </template>
  </main>
</template>
