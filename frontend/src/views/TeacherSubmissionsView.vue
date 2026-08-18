<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { api, apiBlob } from '../api';

type SubmissionSummary = { id: number; student: { name: string; email: string }; status: string; submittedAt: string };
type SubmissionDetail = SubmissionSummary & {
  activity: { title: string }; productText: string; productUrl: string;
  fileName: string | null;
  logbook: null | Record<string, string>;
  aiDeclaration: null | { toolName: string; usageLevel: number; purpose: string; promptSummary: string };
};

const route = useRoute();
const activityId = Number(route.params.id);
const submissions = ref<SubmissionSummary[]>([]);
const selected = ref<SubmissionDetail | null>(null);
const error = ref('');

async function load() {
  try { submissions.value = await api(`/teacher/activities/${activityId}/submissions`); }
  catch (cause) { error.value = cause instanceof Error ? cause.message : 'No se pudieron cargar las entregas'; }
}

async function openSubmission(id: number) {
  try { selected.value = await api(`/teacher/submissions/${id}`); }
  catch (cause) { error.value = cause instanceof Error ? cause.message : 'No se pudo abrir la entrega'; }
}

async function downloadFile() {
  if (!selected.value?.fileName) return;
  try {
    const blob = await apiBlob(`/teacher/submissions/${selected.value.id}/file`);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = selected.value.fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo descargar el archivo';
  }
}

onMounted(load);
</script>

<template>
  <main class="page narrow">
    <RouterLink to="/teacher" class="back-link">← Panel docente</RouterLink>
    <section class="page-heading compact"><div><span class="eyebrow">Evidencias</span><h1>Productos entregados</h1></div></section>
    <p v-if="error" class="alert error">{{ error }}</p>
    <section class="split-view">
      <div class="submission-list panel">
        <button v-for="item in submissions" :key="item.id" :class="{ selected: selected?.id === item.id }" @click="openSubmission(item.id)">
          <strong>{{ item.student.name }}</strong><span>{{ item.student.email }}</span><small>{{ new Date(item.submittedAt).toLocaleString() }}</small>
        </button>
        <p v-if="!submissions.length" class="empty-state">Todavía no hay entregas.</p>
      </div>
      <article v-if="selected" class="panel evidence">
        <span class="eyebrow">{{ selected.activity.title }}</span><h2>{{ selected.student.name }}</h2>
        <h3>Producto final</h3><p class="evidence-text">{{ selected.productText || 'Sin contenido de texto.' }}</p>
        <a v-if="selected.productUrl" :href="selected.productUrl" target="_blank" rel="noopener">Abrir enlace del producto ↗</a>
        <button v-if="selected.fileName" class="button secondary" type="button" @click="downloadFile">
          Descargar {{ selected.fileName }}
        </button>
        <template v-if="selected.logbook">
          <h3>Bitácora</h3>
          <dl><dt>Ideas iniciales</dt><dd>{{ selected.logbook.initialIdeas }}</dd><dt>Prompts</dt><dd>{{ selected.logbook.prompts }}</dd><dt>Validaciones y decisiones</dt><dd>{{ selected.logbook.validationsAndDecisions }}</dd><dt>Reflexión final</dt><dd>{{ selected.logbook.finalReflection }}</dd></dl>
        </template>
        <template v-if="selected.aiDeclaration">
          <h3>Declaración de IA</h3>
          <dl><dt>Herramienta</dt><dd>{{ selected.aiDeclaration.toolName }}</dd><dt>Nivel declarado</dt><dd>{{ selected.aiDeclaration.usageLevel }}</dd><dt>Propósito</dt><dd>{{ selected.aiDeclaration.purpose }}</dd><dt>Resumen de prompts</dt><dd>{{ selected.aiDeclaration.promptSummary }}</dd></dl>
        </template>
      </article>
      <div v-else class="empty-state panel">Selecciona una entrega para consultar su evidencia.</div>
    </section>
  </main>
</template>
