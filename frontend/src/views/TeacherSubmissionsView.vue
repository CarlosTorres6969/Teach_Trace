<script setup lang="ts">
import {
  ArrowLeftIcon,
  CircleCheckIcon,
  ClipboardCheckIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileDownIcon,
  LoaderCircleIcon,
  MegaphoneIcon,
  SaveIcon,
  SparklesIcon,
} from '@lucide/vue';
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { api, apiBlob } from '../api';
import PageLoader from '../components/PageLoader.vue';

type SubmissionSummary = {
  id: number;
  student: { name: string; email: string };
  status: string;
  evaluationStatus: string;
  manualReviewRequired: boolean;
  submittedAt: string;
};

type ValuationItem = {
  id: number;
  criterion: string;
  dimension: string;
  aiValue: number | null;
  aiExplanation: string;
  teacherValue: number | null;
  teacherComment: string;
  confirmed: boolean;
};

type ConversationMessage = {
  id: number;
  role: 'student' | 'ai';
  content: string;
  sequence: number;
  createdAt: string;
};

type LearningOutcomeAssessment = {
  learningOutcome: string;
  score: number | null;
  explanation: string;
  evidence: string[];
};

type PromptPurpose =
  | 'exploration'
  | 'generation'
  | 'drafting'
  | 'correction'
  | 'verification'
  | 'refinement'
  | 'other';

type PromptDimension = 'relevance' | 'clarity' | 'refinement' | 'verification' | 'criticalThinking';

type PromptAssessment = {
  scorePercentage: number | null;
  summary: string;
  dimensions: Record<PromptDimension, number | null>;
  prompts: Array<{
    sequence: number;
    content: string;
    purpose: PromptPurpose;
    score: number | null;
    explanation: string;
  }>;
};

type SubmissionDetail = SubmissionSummary & {
  activity: { id: number; title: string };
  productText: string;
  productUrl: string;
  fileName: string | null;
  feedback: string;
  aiStrengths: string;
  aiImprovements: string;
  aiComparison: string;
  aiUnderstandingScore: number | null;
  aiUnderstandingExplanation: string;
  aiLearningOutcomeAssessments: LearningOutcomeAssessment[];
  aiPromptAssessment: PromptAssessment | null;
  aiSuggestedGradePercentage: number | null;
  teacherGradePercentage: number | null;
  aiAnalyzedAt: string | null;
  valuations: ValuationItem[];
  aiConversation: null | { messages: ConversationMessage[] };
  logbook: null | Record<string, string>;
  aiDeclaration: null | {
    toolName: string;
    usageLevel: number;
    detectedUsageLevel: number | null;
    usageDiscrepancy: boolean;
    purpose: string;
    promptSummary: string;
  };
};

const LEVEL_LABELS: Record<number, string> = {
  1: 'Nivel 1 — Insuficiente',
  2: 'Nivel 2 — En desarrollo',
  3: 'Nivel 3 — Satisfactorio',
  4: 'Nivel 4 — Excelente',
};

const PROMPT_PURPOSE_LABELS: Record<PromptPurpose, string> = {
  exploration: 'Exploración inicial',
  generation: 'Generación de ideas',
  drafting: 'Redacción',
  correction: 'Corrección',
  verification: 'Verificación',
  refinement: 'Refinamiento',
  other: 'Otro propósito',
};

const PROMPT_DIMENSION_LABELS: Array<{ key: PromptDimension; label: string }> = [
  { key: 'relevance', label: 'Pertinencia' },
  { key: 'clarity', label: 'Claridad' },
  { key: 'refinement', label: 'Refinamiento' },
  { key: 'verification', label: 'Verificación' },
  { key: 'criticalThinking', label: 'Pensamiento crítico' },
];

const route = useRoute();
const activityId = Number(route.params.id);
const submissions = ref<SubmissionSummary[]>([]);
const selected = ref<SubmissionDetail | null>(null);
const error = ref('');
const message = ref('');
const loading = ref(true);
const detailLoading = ref(false);

// Estado de edición de valoraciones
const editingValues = ref<Record<number, { teacherValue: number; teacherComment: string }>>({});
const savingValuation = ref<Record<number, boolean>>({});
const closingEvaluation = ref(false);
const savingFeedback = ref(false);
const feedbackDraft = ref('');
const startingEvaluation = ref(false);
const startingAiEvaluation = ref(false);

async function load() {
  try {
    submissions.value = await api(`/teacher/activities/${activityId}/submissions`);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudieron cargar las entregas';
  } finally {
    loading.value = false;
  }
}

async function openSubmission(id: number, preserveMessage = false) {
  if (detailLoading.value) return;
  detailLoading.value = true;
  error.value = '';
  if (!preserveMessage) message.value = '';
  try {
    const detail = await api<SubmissionDetail>(`/teacher/submissions/${id}`);
    const orderedConversationMessages = Array.isArray(detail.aiConversation?.messages)
      ? [...detail.aiConversation.messages].sort((left, right) => left.sequence - right.sequence)
      : [];
    const normalizedPromptAssessment = detail.aiPromptAssessment
      ? {
          ...detail.aiPromptAssessment,
          dimensions: {
            relevance: detail.aiPromptAssessment.dimensions?.relevance ?? null,
            clarity: detail.aiPromptAssessment.dimensions?.clarity ?? null,
            refinement: detail.aiPromptAssessment.dimensions?.refinement ?? null,
            verification: detail.aiPromptAssessment.dimensions?.verification ?? null,
            criticalThinking: detail.aiPromptAssessment.dimensions?.criticalThinking ?? null,
          },
          prompts: Array.isArray(detail.aiPromptAssessment.prompts)
            ? [...detail.aiPromptAssessment.prompts]
                .sort((left, right) => left.sequence - right.sequence)
                .map((prompt) => ({
                  ...prompt,
                  content: prompt.content || orderedConversationMessages.find(
                    (message) => message.role === 'student' && message.sequence === prompt.sequence,
                  )?.content || '',
                }))
            : [],
        }
      : null;
    selected.value = {
      ...detail,
      valuations: Array.isArray(detail.valuations) ? detail.valuations : [],
      aiUnderstandingScore: detail.aiUnderstandingScore ?? null,
      aiUnderstandingExplanation: detail.aiUnderstandingExplanation ?? '',
      aiLearningOutcomeAssessments: Array.isArray(detail.aiLearningOutcomeAssessments)
        ? detail.aiLearningOutcomeAssessments
        : [],
      aiPromptAssessment: normalizedPromptAssessment,
      aiSuggestedGradePercentage: detail.aiSuggestedGradePercentage ?? null,
      teacherGradePercentage: detail.teacherGradePercentage ?? null,
      aiConversation: detail.aiConversation
        ? {
            ...detail.aiConversation,
            messages: orderedConversationMessages,
          }
        : null,
    };
    feedbackDraft.value = detail.feedback ?? '';
    // Inicializar valores de edición con los ya confirmados (o vacíos)
    editingValues.value = {};
    for (const v of selected.value.valuations) {
      editingValues.value[v.id] = {
        teacherValue: v.teacherValue ?? 3,
        teacherComment: v.teacherComment ?? '',
      };
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo abrir la entrega';
  } finally {
    detailLoading.value = false;
  }
}

async function startManualEvaluation() {
  if (startingEvaluation.value) return;
  startingEvaluation.value = true;
  error.value = '';
  try {
    await api(`/teacher/activities/${activityId}/evaluation`, { method: 'POST' });
    message.value = 'Evaluación manual iniciada.';
    await load();
    if (submissions.value.length) await openSubmission(submissions.value[0].id, true);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo iniciar la evaluación manual';
  } finally {
    startingEvaluation.value = false;
  }
}

async function runAiEvaluation() {
  if (startingAiEvaluation.value || startingEvaluation.value) return;
  startingAiEvaluation.value = true;
  error.value = '';
  try {
    const result = await api<{
      implemented: boolean;
      processed: number;
      analyzed: number;
      failed: number;
      pendingManualReview: number;
      reason?: string;
    }>(`/entregas/actividad/${activityId}/evaluar`, { method: 'POST' });
    message.value = result.processed === 0
      ? 'No hay entregas pendientes de análisis.'
      : result.failed === 0
        ? `Análisis IA completado para ${result.analyzed} entrega(s). El docente debe confirmar las valoraciones.`
        : result.analyzed > 0
          ? `Análisis parcial: ${result.analyzed} entrega(s) analizadas y ${result.failed} pendientes de revisión o reintento. ${result.reason ?? ''}`.trim()
          : `La IA no pudo analizar ${result.failed} entrega(s): ${result.reason ?? 'requieren revisión manual o reintento'}.`;
    await load();
    if (submissions.value.length) {
      await openSubmission(selected.value?.id ?? submissions.value[0].id, true);
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo ejecutar el análisis IA';
  } finally {
    startingAiEvaluation.value = false;
  }
}

async function saveFeedback() {
  if (!selected.value || savingFeedback.value) return;
  savingFeedback.value = true;
  error.value = '';
  try {
    await api(`/teacher/submissions/${selected.value.id}/feedback`, {
      method: 'PUT',
      body: JSON.stringify({ feedback: feedbackDraft.value }),
    });
    selected.value.feedback = feedbackDraft.value.trim();
    message.value = 'Retroalimentación general guardada.';
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo guardar la retroalimentación';
  } finally {
    savingFeedback.value = false;
  }
}

async function downloadConversation() {
  if (!selected.value?.aiConversation?.messages.length) return;
  try {
    const blob = await apiBlob(`/teacher/submissions/${selected.value.id}/ai-conversation/export`);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `conversacion-ia-${selected.value.id}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo exportar la conversación';
  }
}

async function saveValuation(valuationId: number) {
  if (!selected.value) return;
  savingValuation.value[valuationId] = true;
  error.value = '';
  try {
    const edit = editingValues.value[valuationId];
    const updated = await api<ValuationItem>(
      `/teacher/submissions/${selected.value.id}/valuations/${valuationId}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          teacherValue: edit.teacherValue,
          teacherComment: edit.teacherComment,
        }),
      },
    );
    // Actualizar la valoración en la lista local
    const idx = selected.value.valuations.findIndex((v) => v.id === valuationId);
    if (idx >= 0) selected.value.valuations[idx] = updated;
    message.value = `Criterio "${updated.criterion}" guardado.`;
    await openSubmission(selected.value.id, true);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo guardar la valoración';
  } finally {
    savingValuation.value[valuationId] = false;
  }
}

async function closeEvaluation() {
  if (!selected.value || closingEvaluation.value) return;
  closingEvaluation.value = true;
  error.value = '';
  try {
    await api(`/teacher/submissions/${selected.value.id}/close`, { method: 'PUT' });
    message.value = 'Evaluación publicada. El estudiante recibirá una notificación.';
    selected.value.status = 'evaluated';
    await load();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo cerrar la evaluación';
  } finally {
    closingEvaluation.value = false;
  }
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

const allConfirmed = () =>
  (selected.value?.valuations?.length ?? 0) > 0 &&
  (selected.value?.valuations?.every((v) => v.confirmed) ?? false);

onMounted(load);
</script>

<template>
  <main class="page teacher-submissions-page">
    <nav class="teacher-submissions-nav" aria-label="Navegación de entregas">
      <RouterLink to="/teacher" class="back-link">
        <ArrowLeftIcon class="ui-icon" aria-hidden="true" />
        Panel docente
      </RouterLink>
      <RouterLink
        :to="{ path: '/teacher', query: { section: 'activities' } }"
        class="button secondary"
      >
        <ArrowLeftIcon class="ui-icon" aria-hidden="true" />
        Regresar a actividades
      </RouterLink>
    </nav>
    <section class="page-heading compact">
      <div><span class="eyebrow">Evidencias</span><h1>Productos entregados</h1></div>
      <div class="page-heading-actions">
        <button class="button secondary" type="button" :disabled="startingAiEvaluation || startingEvaluation" @click="runAiEvaluation">
          <LoaderCircleIcon v-if="startingAiEvaluation" class="ui-icon icon-spin" aria-hidden="true" />
          <SparklesIcon v-else class="ui-icon" aria-hidden="true" />
          {{ startingAiEvaluation ? 'Analizando…' : 'Analizar con IA' }}
        </button>
        <button class="button primary" type="button" :disabled="startingEvaluation || startingAiEvaluation" @click="startManualEvaluation">
          <LoaderCircleIcon v-if="startingEvaluation" class="ui-icon icon-spin" aria-hidden="true" />
          <ClipboardCheckIcon v-else class="ui-icon" aria-hidden="true" />
          {{ startingEvaluation ? 'Iniciando…' : 'Iniciar evaluación manual' }}
        </button>
      </div>
    </section>

    <p v-if="error" class="alert error">{{ error }}</p>
    <p v-if="message" class="alert success">{{ message }}</p>

    <PageLoader
      v-if="loading"
      label="Cargando entregas…"
      detail="Estamos consultando los productos enviados para esta actividad."
    />

    <section v-else class="split-view">
      <!-- Lista de entregas -->
      <div class="submission-list panel">
        <button
          v-for="item in submissions"
          :key="item.id"
          :class="{ selected: selected?.id === item.id }"
          :disabled="detailLoading"
          @click="openSubmission(item.id)"
        >
          <strong>{{ item.student.name }}</strong>
          <span>{{ item.student.email }}</span>
          <small>{{ new Date(item.submittedAt).toLocaleString() }}</small>
          <span class="status" :data-status="item.status">
            {{ item.status === 'evaluated' ? 'Calificado' : item.status === 'under_review' ? 'En revisión' : 'Entregado' }}
          </span>
        </button>
        <p v-if="!submissions.length" class="empty-state">Todavía no hay entregas.</p>
      </div>

      <!-- Detalle de entrega -->
      <PageLoader
        v-if="detailLoading"
        compact
        label="Abriendo la entrega…"
        detail="Estamos recuperando la evidencia y sus valoraciones."
      />

      <article v-else-if="selected" class="panel evidence">
        <span class="eyebrow">{{ selected.activity.title }}</span>
        <h2>{{ selected.student.name }}</h2>
        <p v-if="selected.manualReviewRequired" class="alert error">Esta entrega requiere revisión manual.</p>

        <!-- Producto final -->
        <h3>Producto final</h3>
        <p class="evidence-text">{{ selected.productText || 'Sin contenido de texto.' }}</p>
        <a v-if="selected.productUrl" class="inline-icon-link" :href="selected.productUrl" target="_blank" rel="noopener">
          Abrir enlace
          <ExternalLinkIcon class="ui-icon" aria-hidden="true" />
        </a>
        <button v-if="selected.fileName" class="button secondary" type="button" @click="downloadFile">
          <DownloadIcon class="ui-icon" aria-hidden="true" />
          Descargar {{ selected.fileName }}
        </button>

        <section v-if="selected.aiConversation?.messages.length" class="conversation-review">
          <div class="valuation-panel-header">
            <div>
              <h3>Conversación registrada</h3>
              <p class="muted">Mensajes ordenados cronológicamente según la evidencia guardada.</p>
            </div>
            <button class="button secondary" type="button" @click="downloadConversation">
              <FileDownIcon class="ui-icon" aria-hidden="true" />
              Exportar TXT
            </button>
          </div>
          <ol class="conversation-transcript">
            <li v-for="item in selected.aiConversation.messages" :key="item.id">
              <strong>{{ item.role === 'student' ? 'Estudiante' : 'IA' }}</strong>
              <p>{{ item.content }}</p>
            </li>
          </ol>
        </section>

        <section v-if="selected.aiPromptAssessment" class="prompt-assessment-review">
          <div class="prompt-assessment-heading">
            <div>
              <span class="eyebrow">Indicador auxiliar</span>
              <h3>Valoración de prompts</h3>
            </div>
            <strong>
              {{ selected.aiPromptAssessment.scorePercentage === null
                ? 'No determinable'
                : `${selected.aiPromptAssessment.scorePercentage}%` }}
            </strong>
          </div>
          <p>{{ selected.aiPromptAssessment.summary }}</p>
          <div class="prompt-dimension-grid">
            <article v-for="dimension in PROMPT_DIMENSION_LABELS" :key="dimension.key">
              <span>{{ dimension.label }}</span>
              <strong>
                {{ selected.aiPromptAssessment.dimensions[dimension.key] === null
                  ? 'No determinable'
                  : `${selected.aiPromptAssessment.dimensions[dimension.key]}/4` }}
              </strong>
            </article>
          </div>
          <ol class="ordered-prompt-list">
            <li
              v-for="(prompt, index) in selected.aiPromptAssessment.prompts"
              :key="prompt.sequence"
            >
              <div class="ordered-prompt-heading">
                <span>Prompt {{ index + 1 }} · {{ PROMPT_PURPOSE_LABELS[prompt.purpose] }}</span>
                <strong>{{ prompt.score === null ? 'No determinable' : `${prompt.score}/4` }}</strong>
              </div>
              <blockquote>{{ prompt.content }}</blockquote>
              <p>{{ prompt.explanation }}</p>
            </li>
          </ol>
          <p class="muted">
            Esta valoración examina la calidad del proceso de interacción con IA; es orientativa y
            queda sujeta a la revisión del docente.
          </p>
        </section>

        <!-- Bitácora -->
        <template v-if="selected.logbook">
          <h3>Bitácora</h3>
          <dl>
            <dt>Ideas iniciales</dt><dd>{{ selected.logbook.initialIdeas }}</dd>
            <dt>Prompts</dt><dd>{{ selected.logbook.prompts }}</dd>
            <dt>Validaciones y decisiones</dt><dd>{{ selected.logbook.validationsAndDecisions }}</dd>
            <dt>Reflexión final</dt><dd>{{ selected.logbook.finalReflection }}</dd>
          </dl>
        </template>

        <!-- Declaración de IA -->
        <template v-if="selected.aiDeclaration">
          <h3>Declaración de IA</h3>
          <p v-if="selected.aiDeclaration.usageDiscrepancy" class="alert error">
            El nivel detectado difiere del nivel declarado.
          </p>
          <dl>
            <dt>Herramienta</dt><dd>{{ selected.aiDeclaration.toolName }}</dd>
            <dt>Nivel declarado</dt><dd>{{ selected.aiDeclaration.usageLevel }}</dd>
            <dt>Nivel detectado</dt><dd>{{ selected.aiDeclaration.detectedUsageLevel ?? 'Pendiente' }}</dd>
            <dt>Propósito</dt><dd>{{ selected.aiDeclaration.purpose }}</dd>
            <dt>Resumen de prompts</dt><dd>{{ selected.aiDeclaration.promptSummary }}</dd>
          </dl>
        </template>

        <!-- ─── Panel de valoraciones ──────────────────────────────────────── -->
        <section v-if="selected.aiAnalyzedAt || selected.aiStrengths || selected.aiImprovements || selected.aiComparison" class="ai-analysis-summary">
          <h3>Resultado del motor IA</h3>
          <p class="muted">Valoración preliminar por criterio; la IA no asigna una calificación final.</p>
          <p v-if="selected.aiStrengths"><strong>Qué hizo bien:</strong> {{ selected.aiStrengths }}</p>
          <p v-if="selected.aiImprovements"><strong>Qué debe mejorar:</strong> {{ selected.aiImprovements }}</p>
          <p v-if="selected.aiComparison"><strong>Comparación declaración/evidencia:</strong> {{ selected.aiComparison }}</p>
        </section>

        <section v-if="selected.aiAnalyzedAt" class="understanding-assessment">
          <div class="understanding-heading">
            <div>
              <span class="eyebrow">Indicador auxiliar</span>
              <h3>Comprensión del tema y propósito</h3>
            </div>
            <strong class="understanding-score">
              {{ selected.aiUnderstandingScore ?? '—' }}<small>/100</small>
            </strong>
          </div>
          <div
            class="understanding-meter"
            role="progressbar"
            aria-label="Comprensión estimada por IA"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-valuenow="selected.aiUnderstandingScore ?? undefined"
          >
            <span :style="{ width: `${selected.aiUnderstandingScore ?? 0}%` }" />
          </div>
          <p class="muted">
            Estimación diagnóstica basada en evidencia; no constituye una calificación y debe ser revisada por el docente.
          </p>
          <p>{{ selected.aiUnderstandingExplanation }}</p>

          <div v-if="selected.aiLearningOutcomeAssessments.length" class="learning-outcome-list">
            <article
              v-for="assessment in selected.aiLearningOutcomeAssessments"
              :key="assessment.learningOutcome"
              class="learning-outcome-card"
            >
              <div class="learning-outcome-heading">
                <strong>{{ assessment.learningOutcome }}</strong>
                <span>{{ assessment.score === null ? 'No determinable' : `${assessment.score}/100` }}</span>
              </div>
              <p>{{ assessment.explanation }}</p>
              <ul v-if="assessment.evidence.length">
                <li v-for="item in assessment.evidence" :key="item">{{ item }}</li>
              </ul>
            </article>
          </div>
        </section>

        <section v-if="selected.aiAnalyzedAt" class="grade-suggestion">
          <div>
            <span class="eyebrow">Referencia para el docente</span>
            <h3>Sugerencia porcentual de la IA</h3>
          </div>
          <div class="grade-comparison">
            <article>
              <span>Sugerencia IA</span>
              <strong>
                {{ selected.aiSuggestedGradePercentage === null
                  ? 'No determinable'
                  : `${selected.aiSuggestedGradePercentage}%` }}
              </strong>
            </article>
            <article>
              <span>Decisión docente confirmada</span>
              <strong>
                {{ selected.teacherGradePercentage === null
                  ? 'Pendiente'
                  : `${selected.teacherGradePercentage}%` }}
              </strong>
            </article>
          </div>
          <div
            v-if="selected.aiSuggestedGradePercentage !== null"
            class="suggested-grade-meter"
            role="progressbar"
            aria-label="Nota porcentual sugerida por IA"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-valuenow="selected.aiSuggestedGradePercentage"
          >
            <span :style="{ width: `${selected.aiSuggestedGradePercentage}%` }" />
          </div>
          <p class="muted">
            Se calcula con todos los niveles 1–4 sugeridos para la rúbrica. Es una referencia
            preliminar: no publica ni reemplaza la calificación decidida por el docente.
          </p>
        </section>

        <template v-if="selected.valuations.length > 0">
          <div class="valuation-panel-header">
            <h3>Valoración por criterio</h3>
            <span
              v-if="selected.status === 'evaluated'"
              class="status"
              data-status="evaluated"
            >Publicada</span>
          </div>

          <div class="valuation-grid">
            <div
              v-for="val in selected.valuations"
              :key="val.id"
              class="valuation-editor"
              :class="{ 'valuation-editor--confirmed': val.confirmed }"
            >
              <div class="valuation-editor-header">
                <div>
                  <span class="eyebrow">{{ val.dimension }}</span>
                  <strong>{{ val.criterion }}</strong>
                </div>
                <span v-if="val.confirmed" class="status" data-status="evaluated">Confirmado</span>
                <span v-else class="status">Pendiente</span>
              </div>

              <div class="valuation-ai-hint" v-if="val.aiValue !== null">
                Sugerencia IA: <strong>{{ LEVEL_LABELS[val.aiValue] }}</strong>
              </div>
              <p v-if="val.aiExplanation" class="valuation-ai-explanation">{{ val.aiExplanation }}</p>

              <div class="valuation-editor-fields">
                <label>
                  Nivel docente
                  <select
                    v-model.number="editingValues[val.id].teacherValue"
                    :disabled="selected.status === 'evaluated'"
                  >
                    <option v-for="n in [1, 2, 3, 4]" :key="n" :value="n">
                      {{ LEVEL_LABELS[n] }}
                    </option>
                  </select>
                </label>
                <label>
                  Comentario
                  <textarea
                    v-model="editingValues[val.id].teacherComment"
                    rows="2"
                    maxlength="1000"
                    :disabled="selected.status === 'evaluated'"
                    placeholder="Opcional — explica el nivel asignado"
                  />
                </label>
              </div>

              <button
                v-if="selected.status !== 'evaluated'"
                class="button secondary"
                type="button"
                :disabled="savingValuation[val.id]"
                @click="saveValuation(val.id)"
              >
                <LoaderCircleIcon v-if="savingValuation[val.id]" class="ui-icon icon-spin" aria-hidden="true" />
                <CircleCheckIcon v-else class="ui-icon" aria-hidden="true" />
                {{ savingValuation[val.id] ? 'Guardando…' : val.confirmed ? 'Actualizar criterio' : 'Confirmar criterio' }}
              </button>
            </div>
          </div>

          <!-- Cerrar evaluación -->
          <div v-if="selected.status !== 'evaluated'" class="valuation-close-row">
            <p class="muted valuation-close-hint">
              {{ allConfirmed()
                ? 'Todos los criterios están confirmados. Puedes publicar la evaluación.'
                : `Confirma todos los criterios antes de publicar (${selected.valuations.filter(v => v.confirmed).length}/${selected.valuations.length} listos).`
              }}
            </p>
            <button
              class="button primary"
              type="button"
              :disabled="closingEvaluation"
              @click="closeEvaluation"
            >
              <LoaderCircleIcon v-if="closingEvaluation" class="ui-icon icon-spin" aria-hidden="true" />
              <MegaphoneIcon v-else class="ui-icon" aria-hidden="true" />
              {{ closingEvaluation ? 'Publicando…' : 'Publicar evaluación' }}
            </button>
          </div>
        </template>


        <section v-if="selected?.status !== 'evaluated'" class="feedback-editor">
          <h3>Retroalimentación general</h3>
          <textarea v-model="feedbackDraft" rows="5" maxlength="5000" placeholder="Escribe una retroalimentación general para el estudiante." />
          <button class="button secondary" type="button" :disabled="savingFeedback" @click="saveFeedback">
            <LoaderCircleIcon v-if="savingFeedback" class="ui-icon icon-spin" aria-hidden="true" />
            <SaveIcon v-else class="ui-icon" aria-hidden="true" />
            {{ savingFeedback ? 'Guardando…' : 'Guardar retroalimentación' }}
          </button>
        </section>
      </article>

      <div v-else class="empty-state panel">
        Selecciona una entrega para consultar su evidencia y evaluar.
      </div>
    </section>
  </main>
</template>
