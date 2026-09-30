<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { api, apiBlob } from '../api';

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

type PromptPurpose =
  | 'exploration'
  | 'generation'
  | 'drafting'
  | 'correction'
  | 'verification'
  | 'refinement'
  | 'other';

type PromptAssessment = {
  scorePercentage: number | null;
  summary: string;
  dimensions: Record<'relevance' | 'clarity' | 'refinement' | 'verification' | 'criticalThinking', number | null>;
  prompts: Array<{
    sequence: number;
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
  aiLearningOutcomeAssessments: Array<{
    learningOutcome: string;
    score: number | null;
    explanation: string;
    evidence: string[];
  }>;
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

const PROMPT_DIMENSION_LABELS: Array<{
  key: keyof PromptAssessment['dimensions'];
  label: string;
}> = [
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

// Estado de edición de valoraciones
const editingValues = ref<Record<number, { teacherValue: number; teacherComment: string }>>({});
const savingValuation = ref<Record<number, boolean>>({});
const closingEvaluation = ref(false);
const savingFeedback = ref(false);
const feedbackDraft = ref('');
const startingEvaluation = ref(false);
const startingAiEvaluation = ref(false);

const currentTeacherGradePercentage = computed(() => {
  const valuations = selected.value?.valuations ?? [];
  if (
    !valuations.length ||
    valuations.some((valuation) => !valuation.confirmed || valuation.teacherValue === null)
  ) {
    return null;
  }
  const total = valuations.reduce((sum, valuation) => sum + (valuation.teacherValue ?? 0), 0);
  return Math.round((total / (valuations.length * 4)) * 10_000) / 100;
});

function promptAssessmentFor(sequence: number) {
  return selected.value?.aiPromptAssessment?.prompts.find(
    (assessment) => assessment.sequence === sequence,
  );
}

function promptPurposeLabel(sequence: number) {
  const assessment = promptAssessmentFor(sequence);
  return assessment ? PROMPT_PURPOSE_LABELS[assessment.purpose] : '';
}

function promptScoreLabel(sequence: number) {
  return promptAssessmentFor(sequence)?.score ?? '—';
}

function promptExplanation(sequence: number) {
  return promptAssessmentFor(sequence)?.explanation || 'Sin explicación disponible.';
}

async function load() {
  try {
    submissions.value = await api(`/teacher/activities/${activityId}/submissions`);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudieron cargar las entregas';
  }
}

async function openSubmission(id: number, preserveMessage = false) {
  error.value = '';
  if (!preserveMessage) message.value = '';
  try {
    const detail = await api<SubmissionDetail>(`/teacher/submissions/${id}`);
    selected.value = {
      ...detail,
      valuations: Array.isArray(detail.valuations) ? detail.valuations : [],
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
  <main class="page narrow">
    <RouterLink to="/teacher" class="back-link">← Panel docente</RouterLink>
    <section class="page-heading compact">
      <div><span class="eyebrow">Evidencias</span><h1>Productos entregados</h1></div>
      <div class="page-heading-actions">
        <button class="button secondary" type="button" :disabled="startingAiEvaluation || startingEvaluation" @click="runAiEvaluation">
          {{ startingAiEvaluation ? 'Analizando…' : 'Analizar con IA' }}
        </button>
        <button class="button primary" type="button" :disabled="startingEvaluation || startingAiEvaluation" @click="startManualEvaluation">
          {{ startingEvaluation ? 'Iniciando…' : 'Iniciar evaluación manual' }}
        </button>
      </div>
    </section>

    <p v-if="error" class="alert error">{{ error }}</p>
    <p v-if="message" class="alert success">{{ message }}</p>

    <section class="split-view">
      <!-- Lista de entregas -->
      <div class="submission-list panel">
        <button
          v-for="item in submissions"
          :key="item.id"
          :class="{ selected: selected?.id === item.id }"
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
      <article v-if="selected" class="panel evidence">
        <span class="eyebrow">{{ selected.activity.title }}</span>
        <h2>{{ selected.student.name }}</h2>
        <p v-if="selected.manualReviewRequired" class="alert error">Esta entrega requiere revisión manual.</p>

        <!-- Producto final -->
        <h3>Producto final</h3>
        <p class="evidence-text">{{ selected.productText || 'Sin contenido de texto.' }}</p>
        <a v-if="selected.productUrl" :href="selected.productUrl" target="_blank" rel="noopener">
          Abrir enlace ↗
        </a>
        <button v-if="selected.fileName" class="button secondary" type="button" @click="downloadFile">
          Descargar {{ selected.fileName }}
        </button>

        <section v-if="selected.aiConversation?.messages.length" class="conversation-review">
          <div class="valuation-panel-header">
            <div>
              <h3>Prompts ordenados y respuestas</h3>
              <p class="muted">Secuencia cronológica registrada durante la actividad.</p>
            </div>
            <button class="button secondary" type="button" @click="downloadConversation">Exportar TXT</button>
          </div>
          <ol class="conversation-transcript">
            <li v-for="item in selected.aiConversation.messages" :key="item.id">
              <strong>{{ item.role === 'student' ? 'Estudiante' : 'IA' }}</strong>
              <p>{{ item.content }}</p>
              <div
                v-if="item.role === 'student' && promptAssessmentFor(item.sequence)"
                class="prompt-item-assessment"
              >
                <span>{{ promptPurposeLabel(item.sequence) }}</span>
                <strong>{{ promptScoreLabel(item.sequence) }}/4</strong>
                <p>{{ promptExplanation(item.sequence) }}</p>
              </div>
            </li>
          </ol>
          <div v-if="selected.aiPromptAssessment" class="prompt-assessment-summary">
            <div class="analysis-score-heading">
              <div>
                <span class="eyebrow">Calidad del proceso de prompting</span>
                <strong>{{ selected.aiPromptAssessment.scorePercentage ?? '—' }}%</strong>
              </div>
              <p>{{ selected.aiPromptAssessment.summary || 'Sin resumen disponible.' }}</p>
            </div>
            <div class="prompt-dimension-grid">
              <div v-for="dimension in PROMPT_DIMENSION_LABELS" :key="dimension.key">
                <span>{{ dimension.label }}</span>
                <strong>{{ selected.aiPromptAssessment.dimensions[dimension.key] ?? '—' }}/4</strong>
              </div>
            </div>
          </div>
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

        <section v-if="selected.aiAnalyzedAt" class="analysis-overview-grid">
          <article class="analysis-metric-card">
            <span class="eyebrow">Comprensión estimada</span>
            <div class="analysis-metric-value">
              <strong>{{ selected.aiUnderstandingScore ?? '—' }}</strong><span>/100</span>
            </div>
            <div class="analysis-meter" aria-hidden="true">
              <span :style="{ width: `${selected.aiUnderstandingScore ?? 0}%` }" />
            </div>
            <p>{{ selected.aiUnderstandingExplanation || 'No fue posible determinar la comprensión.' }}</p>
            <small>Indicador diagnóstico preliminar; no corresponde a la nota final.</small>
          </article>

          <article class="analysis-metric-card">
            <span class="eyebrow">Calificación porcentual</span>
            <div class="grade-comparison">
              <div>
                <span>Sugerencia IA</span>
                <strong>{{ selected.aiSuggestedGradePercentage ?? '—' }}%</strong>
              </div>
              <div>
                <span>Decisión docente</span>
                <strong>{{ currentTeacherGradePercentage ?? '—' }}%</strong>
              </div>
            </div>
            <p class="muted">
              Se calcula desde los niveles de la rúbrica. La nota docente aparece cuando todos los criterios están confirmados.
            </p>
          </article>
        </section>

        <section
          v-if="(selected.aiLearningOutcomeAssessments ?? []).length"
          class="learning-outcome-analysis"
        >
          <div>
            <h3>Comprensión por resultado de aprendizaje</h3>
            <p class="muted">La estimación debe estar respaldada por evidencia concreta de la entrega.</p>
          </div>
          <article
            v-for="assessment in selected.aiLearningOutcomeAssessments"
            :key="assessment.learningOutcome"
            class="learning-outcome-card"
          >
            <div>
              <strong>{{ assessment.learningOutcome }}</strong>
              <span>{{ assessment.score ?? '—' }}/100</span>
            </div>
            <p>{{ assessment.explanation || 'Sin explicación disponible.' }}</p>
            <ul v-if="assessment.evidence.length">
              <li v-for="evidence in assessment.evidence" :key="evidence">{{ evidence }}</li>
            </ul>
          </article>
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
              {{ savingValuation[val.id] ? 'Guardando…' : val.confirmed ? '✓ Actualizar' : 'Confirmar criterio' }}
            </button>
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
              {{ closingEvaluation ? 'Publicando…' : '📢 Publicar evaluación' }}
            </button>
          </div>
        </template>


        <section v-if="selected?.status !== 'evaluated'" class="feedback-editor">
          <h3>Retroalimentación general</h3>
          <textarea v-model="feedbackDraft" rows="5" maxlength="5000" placeholder="Escribe una retroalimentación general para el estudiante." />
          <button class="button secondary" type="button" :disabled="savingFeedback" @click="saveFeedback">
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
