<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { onBeforeRouteLeave, useRoute } from 'vue-router';
import { api } from '../api';

const route = useRoute();
const activityId = Number(route.params.id);
const draftStorageKey = `teachtrace:activity-draft:${activityId}`;
const title = ref('Actividad');
const loading = ref(true);
const message = ref('');
const error = ref('');

const logbook = reactive({ initialIdeas: '', prompts: '', validationsAndDecisions: '', finalReflection: '' });
type LogbookField = keyof typeof logbook;
const savedLogbook = reactive<Record<LogbookField, string>>({
  initialIdeas: '',
  prompts: '',
  validationsAndDecisions: '',
  finalReflection: '',
});
const logbookSteps: Array<{
  key: LogbookField;
  shortTitle: string;
  title: string;
  description: string;
  placeholder: string;
  maxLength: number;
}> = [
  {
    key: 'initialIdeas',
    shortTitle: 'Inicio',
    title: 'Ideas iniciales',
    description: 'Describe cómo entiendes la actividad y qué camino piensas seguir antes de comenzar.',
    placeholder: 'Escribe tus primeras ideas, preguntas o posibles enfoques…',
    maxLength: 10000,
  },
  {
    key: 'prompts',
    shortTitle: 'Prompts',
    title: 'Interacción con IA',
    description: 'Resume los prompts utilizados y registra aquí la conversación que sirve como evidencia.',
    placeholder: 'Resume los prompts relevantes y el contexto en que los utilizaste…',
    maxLength: 10000,
  },
  {
    key: 'validationsAndDecisions',
    shortTitle: 'Validación',
    title: 'Validaciones y decisiones',
    description: 'Explica qué comprobaste, qué descartaste y por qué tomaste cada decisión importante.',
    placeholder: 'Describe tus comprobaciones, fuentes consultadas y decisiones…',
    maxLength: 20000,
  },
  {
    key: 'finalReflection',
    shortTitle: 'Reflexión',
    title: 'Reflexión final',
    description: 'Resume qué aprendiste, qué cambiarías y cómo evolucionó tu solución.',
    placeholder: 'Reflexiona sobre tu aprendizaje y el proceso que seguiste…',
    maxLength: 10000,
  },
];

const declaration = reactive({
  toolName: '',
  usageLevel: '' as number | '',
  purpose: '',
});
type ConversationRole = 'student' | 'ai';
type ConversationMessage = { role: ConversationRole; content: string; createdAt?: string };
const conversation = ref<ConversationMessage[]>([]);
const savedConversationSignature = ref('');
const savingConversation = ref(false);
const submission = reactive({
  status: 'not_submitted',
  submittedAt: '',
  productText: '',
  productUrl: '',
  fileName: null as string | null,
  evaluationStatus: 'not_requested',
  manualReviewRequired: false,
});
const selectedFile = ref<File | null>(null);

const totalSteps = logbookSteps.length + 1;
const currentStep = ref(0);
const savingLogbook = ref(false);
const submittingEvidence = ref(false);
const autosaveStatus = ref('El avance se guarda automáticamente.');
const hydrated = ref(false);
let logbookDirty = false;
let logbookRevision = 0;
let conversationDirty = false;
let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
let draftPersistenceEnabled = true;
const isSubmissionStep = computed(() => currentStep.value === logbookSteps.length);
const activeStep = computed(() => logbookSteps[currentStep.value]);

const stepCompletion = computed<boolean[]>(() => [
  ...logbookSteps.map((step) =>
    step.key === 'prompts'
      ? isLogbookStepSaved(step.key) && isConversationSaved()
      : isLogbookStepSaved(step.key),
  ),
  submission.status !== 'not_submitted',
]);
const completedStepCount = computed(() => stepCompletion.value.filter(Boolean).length);
const progressPercentage = computed(() => (completedStepCount.value / totalSteps) * 100);
const missingSteps = computed(() => [
  ...logbookSteps.map((step, index) => ({ title: step.title, complete: stepCompletion.value[index] })),
  { title: 'Entrega final', complete: stepCompletion.value[totalSteps - 1] },
].filter((step) => !step.complete));
const isLastStep = computed(() => currentStep.value === totalSteps - 1);
const currentStepNotice = computed(() => {
  if (isSubmissionStep.value) {
    if (submission.status !== 'not_submitted') {
      return { state: 'saved', message: 'La entrega final ya fue guardada. Puedes actualizarla si lo necesitas.' };
    }

    const missing: string[] = [];
    if (!selectedFile.value && !submission.fileName) missing.push('adjuntar el archivo PDF');
    if (!declaration.toolName.trim()) missing.push('indicar la herramienta de IA');
    if (typeof declaration.usageLevel !== 'number' || ![1, 2, 3].includes(declaration.usageLevel)) {
      missing.push('seleccionar el nivel de uso de IA');
    }
    if (!declaration.purpose.trim()) missing.push('describir el propósito de uso de IA');

    return missing.length
      ? { state: 'pending', message: `Para realizar la entrega falta: ${missing.join(', ')}.` }
      : { state: 'ready', message: 'La información está completa. Presiona “Realizar entrega” para finalizar.' };
  }

  const step = activeStep.value;
  if (!step) return { state: 'pending', message: 'Selecciona un paso para continuar.' };
  const requirement = logbookStepRequirement(step);
  if (requirement) return { state: 'pending', message: requirement };
  if (stepCompletion.value[currentStep.value]) {
    return { state: 'saved', message: 'Este paso está guardado correctamente.' };
  }
  return { state: 'unsaved', message: 'Hay cambios sin guardar. Presiona “Guardar progreso” para conservarlos.' };
});

const statusText = computed(() => ({
  not_submitted: 'Sin entregar', submitted: 'Entregado', under_review: 'En revisión', evaluated: 'Evaluado',
}[submission.status] ?? submission.status));

type ActivityDraft = {
  version: 1;
  updatedAt: string;
  currentStep: number;
  logbook: Record<LogbookField, string>;
  declaration: { toolName: string; usageLevel: number | ''; purpose: string };
  submission: { productText: string; productUrl: string };
  conversation: ConversationMessage[];
};

function hasCompleteConversation() {
  return (
    conversation.value.some((item) => item.role === 'student' && item.content.trim()) &&
    conversation.value.some((item) => item.role === 'ai' && item.content.trim()) &&
    conversation.value.every((item) => item.content.trim())
  );
}

function conversationSignature(messages = conversation.value) {
  return JSON.stringify(
    messages.map(({ role, content }) => ({ role, content: content.trim() })),
  );
}

function isLogbookStepSaved(key: LogbookField) {
  return logbook[key].trim().length > 0 && logbook[key] === savedLogbook[key];
}

function isConversationSaved() {
  return (
    hasCompleteConversation() &&
    conversationSignature() === savedConversationSignature.value
  );
}

function logbookStepRequirement(step: (typeof logbookSteps)[number]) {
  const emptyMessages: Record<LogbookField, string> = {
    initialIdeas: 'Escribe tus ideas iniciales antes de guardar este paso.',
    prompts: 'Escribe el resumen de prompts antes de guardar este paso.',
    validationsAndDecisions: 'Describe al menos una validación o decisión antes de guardar este paso.',
    finalReflection: 'Escribe tu reflexión final antes de guardar este paso.',
  };
  if (!logbook[step.key].trim()) return emptyMessages[step.key];
  if (step.key !== 'prompts') return '';

  const hasStudentPrompt = conversation.value.some(
    (item) => item.role === 'student' && item.content.trim(),
  );
  const hasAiResponse = conversation.value.some(
    (item) => item.role === 'ai' && item.content.trim(),
  );
  if (!hasStudentPrompt && !hasAiResponse) {
    return 'Agrega al menos un prompt del estudiante y una respuesta de IA antes de guardar este paso.';
  }
  if (!hasStudentPrompt) return 'Agrega al menos un prompt del estudiante antes de guardar este paso.';
  if (!hasAiResponse) return 'Agrega al menos una respuesta de IA antes de guardar este paso.';
  if (conversation.value.some((item) => !item.content.trim())) {
    return 'Completa o elimina los mensajes vacíos de la conversación antes de guardar este paso.';
  }
  return '';
}

function stepStatus(index: number) {
  if (stepCompletion.value[index]) return index === totalSteps - 1 ? 'Entregado' : 'Guardado';
  if (index === totalSteps - 1) return 'Pendiente';
  const step = logbookSteps[index];
  if (!logbook[step.key].trim()) return 'Pendiente';
  if (step.key === 'prompts' && !hasCompleteConversation()) return 'Falta conversación';
  return 'Sin guardar';
}

function persistLocalDraft() {
  if (!hydrated.value || !draftPersistenceEnabled || typeof window === 'undefined') return;
  const draft: ActivityDraft = {
    version: 1,
    updatedAt: new Date().toISOString(),
    currentStep: currentStep.value,
    logbook: { ...logbook },
    declaration: {
      toolName: declaration.toolName,
      usageLevel: declaration.usageLevel,
      purpose: declaration.purpose,
    },
    submission: {
      productText: submission.productText,
      productUrl: submission.productUrl,
    },
    conversation: conversation.value.map(({ role, content, createdAt }) => ({ role, content, createdAt })),
  };
  try {
    window.localStorage.setItem(draftStorageKey, JSON.stringify(draft));
  } catch {
    autosaveStatus.value = 'El navegador no pudo guardar el borrador local.';
  }
}

function restoreLocalDraft() {
  if (typeof window === 'undefined') return false;
  try {
    const stored = window.localStorage.getItem(draftStorageKey);
    if (!stored) return false;
    const draft = JSON.parse(stored) as Partial<ActivityDraft>;
    if (draft.version !== 1) return false;

    for (const step of logbookSteps) {
      const value = draft.logbook?.[step.key];
      if (typeof value === 'string') logbook[step.key] = value;
    }
    if (typeof draft.declaration?.toolName === 'string') {
      declaration.toolName = draft.declaration.toolName;
    }
    if (
      draft.declaration?.usageLevel === '' ||
      (typeof draft.declaration?.usageLevel === 'number' && [1, 2, 3].includes(draft.declaration.usageLevel))
    ) {
      declaration.usageLevel = draft.declaration.usageLevel;
    }
    if (typeof draft.declaration?.purpose === 'string') {
      declaration.purpose = draft.declaration.purpose;
    }
    if (typeof draft.submission?.productText === 'string') {
      submission.productText = draft.submission.productText;
    }
    if (typeof draft.submission?.productUrl === 'string') {
      submission.productUrl = draft.submission.productUrl;
    }
    if (Array.isArray(draft.conversation)) {
      conversation.value = draft.conversation
        .filter(
          (item): item is ConversationMessage =>
            Boolean(item) &&
            (item.role === 'student' || item.role === 'ai') &&
            typeof item.content === 'string',
        )
        .map(({ role, content, createdAt }) => ({ role, content, createdAt }));
    }
    if (Number.isInteger(draft.currentStep)) {
      currentStep.value = Math.min(Math.max(draft.currentStep ?? 0, 0), totalSteps - 1);
    }
    autosaveStatus.value = 'Borrador recuperado. El avance continúa guardándose automáticamente.';
    return true;
  } catch {
    window.localStorage.removeItem(draftStorageKey);
    return false;
  }
}

async function load() {
  try {
    const [logbookData, declarationData, submissionData, conversationData] = await Promise.all([
      api<Record<string, string> & { activity: { title: string } }>(`/student/activities/${activityId}/logbook`),
      api<Record<string, string | number | null>>(`/student/activities/${activityId}/ai-declaration`),
      api<Record<string, string> & { activity: { title: string } }>(`/student/activities/${activityId}/submission-status`),
      api<{ messages: ConversationMessage[] } | null>(`/student/activities/${activityId}/ai-conversation`),
    ]);
    title.value = logbookData.activity.title;
    Object.assign(logbook, {
      initialIdeas: logbookData.initialIdeas ?? '',
      prompts: logbookData.prompts ?? '',
      validationsAndDecisions: logbookData.validationsAndDecisions ?? '',
      finalReflection: logbookData.finalReflection ?? '',
    });
    Object.assign(savedLogbook, logbook);
    const loadedUsageLevel = declarationData.usageLevel;
    declaration.toolName = typeof declarationData.toolName === 'string' ? declarationData.toolName : '';
    declaration.usageLevel =
      typeof loadedUsageLevel === 'number' && [1, 2, 3].includes(loadedUsageLevel)
        ? loadedUsageLevel
        : '';
    declaration.purpose = typeof declarationData.purpose === 'string' ? declarationData.purpose : '';
    let promptNeedsMigration = false;
    if (!logbook.prompts.trim() && typeof declarationData.promptSummary === 'string') {
      logbook.prompts = declarationData.promptSummary;
      promptNeedsMigration = Boolean(logbook.prompts.trim());
    }
    Object.assign(submission, submissionData);
    conversation.value = conversationData?.messages ?? [];
    savedConversationSignature.value = conversationSignature(conversation.value);
    const restoredDraft = restoreLocalDraft();
    hydrated.value = true;
    if (restoredDraft || promptNeedsMigration) {
      logbookDirty = true;
      conversationDirty = conversationSignature() !== savedConversationSignature.value;
      scheduleLogbookAutosave();
      autosaveStatus.value = 'Borrador recuperado. El avance continúa guardándose automáticamente.';
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo cargar la actividad';
  } finally {
    loading.value = false;
  }
}

async function markActivityViewed() {
  try {
    await api(`/student/activities/${activityId}/mark-viewed`, { method: 'PATCH' });
    window.dispatchEvent(new CustomEvent('teachtrace:activity-viewed'));
  } catch {
    // La lectura del detalle no debe bloquearse si el indicador no puede actualizarse.
  }
}

function openStep(index: number) {
  persistLocalDraft();
  void flushProgress(true);
  currentStep.value = index;
  message.value = '';
  error.value = '';
}

async function saveLogbookProgress(success = '', silent = false) {
  if (autosaveTimer) {
    clearTimeout(autosaveTimer);
    autosaveTimer = null;
  }
  for (const step of logbookSteps) {
    const normalized = logbook[step.key].trim();
    if (logbook[step.key] !== normalized) logbook[step.key] = normalized;
  }
  const savingRevision = logbookRevision;
  const payload: Record<LogbookField, string> = {
    initialIdeas: logbook.initialIdeas,
    prompts: logbook.prompts,
    validationsAndDecisions: logbook.validationsAndDecisions,
    finalReflection: logbook.finalReflection,
  };
  savingLogbook.value = true;
  try {
    const saved = await api<Partial<Record<LogbookField, string>>>(`/student/activities/${activityId}/logbook`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    for (const step of logbookSteps) {
      savedLogbook[step.key] = typeof saved?.[step.key] === 'string'
        ? saved[step.key]!
        : payload[step.key];
    }
    logbookDirty =
      savingRevision !== logbookRevision ||
      logbookSteps.some((step) => logbook[step.key] !== savedLogbook[step.key]);
    autosaveStatus.value = 'Avance guardado.';
    if (logbookDirty) scheduleLogbookAutosave();
    if (!silent) {
      message.value = success;
      error.value = '';
    }
    return true;
  } catch (cause) {
    autosaveStatus.value = 'El avance quedó en este dispositivo y se sincronizará al volver a intentarlo.';
    if (!silent) {
      error.value = cause instanceof Error ? cause.message : 'No fue posible guardar';
      message.value = '';
    }
    return false;
  } finally {
    savingLogbook.value = false;
  }
}

function scheduleLogbookAutosave() {
  if (!hydrated.value || !logbookDirty) return;
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveStatus.value = 'Guardando avance…';
  autosaveTimer = setTimeout(() => {
    autosaveTimer = null;
    void saveLogbookProgress('', true);
  }, 700);
}

async function flushProgress(silent = true) {
  persistLocalDraft();
  const tasks: Promise<boolean>[] = [];
  if (logbookDirty) tasks.push(saveLogbookProgress('', silent));
  if (conversationDirty && hasCompleteConversation()) tasks.push(saveConversation(silent));
  if (tasks.length) await Promise.all(tasks);
}

async function submitLogbookStep() {
  const saved = await saveCurrentLogbookStep('Paso guardado correctamente.');
  if (saved && !isLastStep.value) currentStep.value += 1;
}

async function saveWithoutAdvancing() {
  await saveCurrentLogbookStep('Progreso guardado correctamente.');
}

async function saveCurrentLogbookStep(success: string) {
  const step = activeStep.value;
  if (!step) return false;
  const requirement = logbookStepRequirement(step);
  if (requirement) {
    error.value = requirement;
    message.value = '';
    return false;
  }
  return step.key === 'prompts'
    ? saveAiInteraction(success)
    : saveLogbookProgress(success);
}

function selectFile(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0] ?? null;
  if (file && (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf'))) {
    error.value = 'La evidencia debe ser un archivo PDF.';
    target.value = '';
    selectedFile.value = null;
    return;
  }
  if (file && file.size > 10 * 1024 * 1024) {
    error.value = 'El archivo no puede superar 10 MB.';
    target.value = '';
    selectedFile.value = null;
    return;
  }
  error.value = '';
  selectedFile.value = file;
}

function addConversationMessage(role: ConversationRole) {
  conversation.value.push({ role, content: '' });
}

function removeConversationMessage(index: number) {
  conversation.value.splice(index, 1);
}

async function saveAiInteraction(success = 'Interacción con IA guardada.') {
  const requirement = logbookStepRequirement(logbookSteps[1]);
  if (requirement) {
    error.value = requirement;
    message.value = '';
    return false;
  }

  const logbookSaved = await saveLogbookProgress('', true);
  if (!logbookSaved) {
    error.value = 'No fue posible guardar el resumen de prompts.';
    return false;
  }
  const conversationSaved = await saveConversation(true);
  if (!conversationSaved) {
    error.value = 'No fue posible guardar la conversación con IA.';
    return false;
  }
  message.value = success;
  error.value = '';
  return true;
}

async function saveConversation(silent = false) {
  if (!conversation.value.length) return false;
  if (conversation.value.some((item) => !item.content.trim())) {
    if (!silent) error.value = 'Completa todos los mensajes de la conversación con IA.';
    return false;
  }
  savingConversation.value = true;
  try {
    const saved = await api<{ messages: ConversationMessage[] }>(
      `/student/activities/${activityId}/ai-conversation`,
      {
        method: 'PUT',
        body: JSON.stringify({
          messages: conversation.value.map(({ role, content }) => ({ role, content })),
        }),
      },
    );
    conversation.value = saved.messages;
    savedConversationSignature.value = conversationSignature(saved.messages);
    conversationDirty = false;
    if (!silent) {
      message.value = 'Conversación con IA guardada.';
      error.value = '';
    }
    return true;
  } catch (cause) {
    if (!silent) {
      error.value = cause instanceof Error ? cause.message : 'No fue posible guardar la conversación';
      message.value = '';
    }
    return false;
  } finally {
    savingConversation.value = false;
  }
}

async function submitEvidence() {
  const incompleteLogbook = logbookSteps
    .filter((step) => !logbook[step.key].trim())
    .map((step) => step.title);
  if (incompleteLogbook.length) {
    error.value = `Completa la bitácora antes de entregar. Faltan: ${incompleteLogbook.join(', ')}.`;
    return;
  }
  if (!selectedFile.value && !submission.fileName) {
    error.value = 'Adjunta la tarea en un archivo PDF.';
    return;
  }
  if (!hasCompleteConversation()) {
    error.value = 'Completa en el paso 2 al menos un prompt del estudiante y una respuesta de IA.';
    return;
  }
  if (!declaration.toolName.trim()) {
    error.value = 'Indica el nombre de la herramienta de IA utilizada.';
    return;
  }
  const usageLevel = declaration.usageLevel;
  if (typeof usageLevel !== 'number' || ![1, 2, 3].includes(usageLevel)) {
    error.value = 'Selecciona tu nivel declarado de uso de IA.';
    return;
  }
  const purpose = declaration.purpose.trim();
  if (!purpose) {
    error.value = 'Describe el propósito para el cual utilizaste IA.';
    return;
  }
  const promptSummary = logbook.prompts.trim();
  if (!promptSummary) {
    error.value = 'Escribe un resumen de los prompts utilizados.';
    return;
  }
  message.value = '';
  error.value = '';
  submittingEvidence.value = true;
  const form = new FormData();
  form.set('productText', submission.productText);
  form.set('productUrl', submission.productUrl);
  form.set('toolName', declaration.toolName);
  form.set('usageLevel', String(usageLevel));
  form.set('purpose', purpose);
  form.set('promptSummary', promptSummary);
  if (selectedFile.value) form.set('file', selectedFile.value);
  try {
    const logbookSaved = await saveLogbookProgress('Bitácora guardada');
    if (!logbookSaved) return;
    const conversationSaved = await saveConversation(true);
    if (!conversationSaved) {
      error.value = 'No fue posible guardar la conversación con IA.';
      return;
    }
    const result = await api<Record<string, string | null>>(
      `/student/activities/${activityId}/submission`,
      { method: 'PUT', body: form },
    );
    Object.assign(submission, result);
    selectedFile.value = null;
    draftPersistenceEnabled = false;
    window.localStorage.removeItem(draftStorageKey);
    message.value = '¡Entrega completada! Producto y declaración de IA guardados correctamente.';
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No fue posible guardar la entrega';
  } finally {
    submittingEvidence.value = false;
  }
}

async function onWizardSubmit() {
  if (isSubmissionStep.value) {
    await submitEvidence();
    return;
  }
  await submitLogbookStep();
}

watch(
  logbook,
  () => {
    if (!hydrated.value) return;
    draftPersistenceEnabled = true;
    logbookDirty = true;
    logbookRevision += 1;
    persistLocalDraft();
    scheduleLogbookAutosave();
  },
  { deep: true, flush: 'sync' },
);

watch(
  [
    currentStep,
    () => declaration.toolName,
    () => declaration.usageLevel,
    () => declaration.purpose,
    () => submission.productText,
    () => submission.productUrl,
  ],
  () => {
    if (!hydrated.value) return;
    draftPersistenceEnabled = true;
    persistLocalDraft();
  },
  { deep: true, flush: 'sync' },
);

watch(
  conversation,
  () => {
    if (!hydrated.value) return;
    draftPersistenceEnabled = true;
    conversationDirty = true;
    persistLocalDraft();
  },
  { deep: true, flush: 'sync' },
);

onBeforeRouteLeave(async () => {
  persistLocalDraft();
  await flushProgress(true);
});

onBeforeUnmount(() => {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  persistLocalDraft();
});

onMounted(() => {
  void load();
  void markActivityViewed();
});
</script>

<template>
  <main class="page narrow">
    <RouterLink to="/student" class="back-link">← Mis actividades</RouterLink>
    <section class="page-heading compact"><div><span class="eyebrow">Actividad</span><h1>{{ title }}</h1></div></section>
    <p v-if="loading" class="muted">Cargando…</p>
    <template v-else>
      <p v-if="message" class="alert success">{{ message }}</p>
      <p v-if="error" class="alert error">{{ error }}</p>

      <form class="panel logbook-wizard" @submit.prevent="onWizardSubmit">
        <div class="logbook-heading">
          <div>
            <span class="eyebrow">Proceso guiado</span>
            <h2>Bitácora y entrega</h2>
            <p class="muted">Un solo proceso paso a paso: registra tu bitácora y finaliza con tu entrega.</p>
          </div>
          <span class="logbook-progress-label">
            {{ completedStepCount }} de {{ totalSteps }} pasos completados
          </span>
        </div>

        <div
          class="logbook-progress"
          role="progressbar"
          :aria-valuenow="completedStepCount"
          aria-valuemin="0"
          :aria-valuemax="totalSteps"
          :aria-label="`${completedStepCount} de ${totalSteps} pasos guardados`"
        >
          <span :style="{ width: `${progressPercentage}%` }" />
        </div>
        <p class="autosave-status muted" aria-live="polite">{{ autosaveStatus }}</p>

        <section class="progress-checklist" aria-live="polite">
          <template v-if="missingSteps.length">
            <strong>Para completar la actividad todavía falta:</strong>
            <ul>
              <li v-for="step in missingSteps" :key="step.title">{{ step.title }}</li>
            </ul>
          </template>
          <p v-else>Todos los pasos están guardados y la actividad fue entregada.</p>
        </section>

        <ol class="logbook-steps" aria-label="Pasos del proceso de entrega">
          <li v-for="(step, index) in logbookSteps" :key="step.key">
            <button
              type="button"
              class="logbook-step-button"
              :class="{ active: currentStep === index, completed: stepCompletion[index] }"
              :aria-current="currentStep === index ? 'step' : undefined"
              @click="openStep(index)"
            >
              <span class="logbook-step-number">{{ stepCompletion[index] ? '✓' : index + 1 }}</span>
              <span>
                <small>Paso {{ index + 1 }}</small>
                <strong>{{ step.shortTitle }}</strong>
                <em class="step-save-status">{{ stepStatus(index) }}</em>
              </span>
            </button>
          </li>
          <li>
            <button
              type="button"
              class="logbook-step-button submission-step-button"
              :class="{ active: isSubmissionStep, completed: stepCompletion[totalSteps - 1] }"
              :aria-current="isSubmissionStep ? 'step' : undefined"
              @click="openStep(logbookSteps.length)"
            >
              <span class="logbook-step-number">
                {{ stepCompletion[totalSteps - 1] ? '✓' : totalSteps }}
              </span>
              <span>
                <small>Paso {{ totalSteps }}</small>
                <strong>Entrega</strong>
                <em class="step-save-status">{{ stepStatus(totalSteps - 1) }}</em>
              </span>
            </button>
          </li>
        </ol>

        <section v-if="!isSubmissionStep" class="logbook-step-content">
          <span class="eyebrow">Paso {{ currentStep + 1 }} de {{ totalSteps }}</span>
          <h3>{{ activeStep.title }}</h3>
          <p class="muted">{{ activeStep.description }}</p>
          <label>
            {{ activeStep.key === 'prompts' ? 'Resumen de prompts' : 'Tu registro' }}
            <textarea
              :key="activeStep.key"
              v-model="logbook[activeStep.key]"
              rows="9"
              :maxlength="activeStep.maxLength"
              :placeholder="activeStep.placeholder"
              autofocus
            />
            <small class="character-count">
              {{ logbook[activeStep.key].length.toLocaleString() }} /
              {{ activeStep.maxLength.toLocaleString() }} caracteres
            </small>
          </label>

          <section
            v-if="activeStep.key === 'prompts'"
            class="conversation-editor"
            aria-labelledby="conversation-title"
          >
            <div>
              <h3 id="conversation-title">Conversación con IA</h3>
              <p class="muted">Registra al menos un prompt del estudiante y una respuesta de IA. Esta evidencia se captura una sola vez en este paso.</p>
            </div>
            <div v-if="conversation.length" class="conversation-messages">
              <article v-for="(item, index) in conversation" :key="index" class="conversation-message">
                <label>
                  Participante
                  <select v-model="item.role">
                    <option value="student">Estudiante</option>
                    <option value="ai">IA</option>
                  </select>
                </label>
                <label>
                  Mensaje
                  <textarea v-model="item.content" rows="3" maxlength="20000" required />
                </label>
                <button class="button secondary" type="button" @click="removeConversationMessage(index)">Quitar mensaje</button>
              </article>
            </div>
            <div class="conversation-actions">
              <button class="button secondary" type="button" @click="addConversationMessage('student')">Agregar mensaje del estudiante</button>
              <button class="button secondary" type="button" @click="addConversationMessage('ai')">Agregar respuesta de IA</button>
            </div>
          </section>
        </section>

        <section v-else class="logbook-step-content">
          <div class="card-topline">
            <div>
              <span class="eyebrow">Paso {{ totalSteps }} de {{ totalSteps }}</span>
              <h3>Producto final y declaración de IA</h3>
            </div>
            <span class="status" :data-status="submission.status">{{ statusText }}</span>
          </div>
          <p class="muted">Cierra tu proceso entregando el producto académico junto a tu declaración de uso de IA.</p>
          <div class="form-stack submission-fields">
            <label>Contenido del producto<textarea v-model="submission.productText" rows="7" maxlength="50000" /></label>
            <label>Enlace complementario<input v-model="submission.productUrl" type="url" placeholder="https://…" maxlength="500" /></label>
            <label>Archivo PDF obligatorio
              <input type="file" accept="application/pdf,.pdf" :required="!submission.fileName" @change="selectFile" />
              <small class="muted">Debes adjuntar la tarea en PDF. Tamaño máximo: 10 MB. Si sales antes de entregar, deberás seleccionar el archivo nuevamente.</small>
            </label>
            <p v-if="submission.fileName" class="muted">Archivo guardado: {{ submission.fileName }}</p>
            <p v-if="submission.manualReviewRequired" class="alert error">La entrega quedó marcada para revisión manual.</p>
            <h3>Declaración de uso de IA</h3>
            <label>Herramienta utilizada<input v-model.trim="declaration.toolName" maxlength="120" placeholder="Ej. ChatGPT, Gemini o Copilot" required /></label>
            <label>Nivel declarado
              <select v-model.number="declaration.usageLevel" required>
                <option value="" disabled>Selecciona un nivel</option>
                <option :value="1">Nivel 1 - Autor propio</option>
                <option :value="2">Nivel 2 - Uso mínimo</option>
                <option :value="3">Nivel 3 - Hecho por IA</option>
              </select>
            </label>
            <label>Propósito<textarea v-model.trim="declaration.purpose" rows="3" maxlength="5000" required /></label>
            <p v-if="submission.submittedAt" class="muted">Última entrega: {{ new Date(submission.submittedAt).toLocaleString() }}</p>
          </div>
        </section>

        <p
          class="step-guidance"
          :data-state="currentStepNotice.state"
          role="status"
          aria-live="polite"
        >
          {{ currentStepNotice.message }}
        </p>

        <div class="logbook-actions">
          <button
            v-if="currentStep > 0"
            class="button secondary"
            type="button"
            :disabled="savingLogbook || savingConversation || submittingEvidence"
            @click="openStep(currentStep - 1)"
          >
            ← Anterior
          </button>
          <span v-else />
          <div>
            <button
              v-if="!isSubmissionStep"
              class="button secondary"
              type="button"
              :disabled="savingLogbook || savingConversation"
              @click="saveWithoutAdvancing"
            >
              {{ savingLogbook || savingConversation ? 'Guardando…' : 'Guardar progreso' }}
            </button>
            <button class="button primary" :disabled="savingLogbook || savingConversation || submittingEvidence">
              {{
                isSubmissionStep
                  ? (submittingEvidence
                      ? 'Enviando…'
                      : submission.status === 'not_submitted'
                        ? 'Realizar entrega'
                        : 'Actualizar entrega')
                  : (savingLogbook ? 'Guardando…' : 'Guardar y continuar →')
              }}
            </button>
          </div>
        </div>
      </form>
    </template>
  </main>
</template>

<style scoped>
.submission-step-button strong { color: inherit; }
.submission-fields h3 { margin-top: .5rem; padding-top: 1rem; border-top: 1px solid var(--line); }
.logbook-step-content .form-stack { margin-top: 1rem; }
.progress-checklist { margin: .75rem 0 1rem; padding: .85rem 1rem; border: 1px solid var(--line); border-radius: .75rem; background: var(--green-light); }
.progress-checklist strong, .progress-checklist p { margin: 0; }
.progress-checklist ul { display: flex; flex-wrap: wrap; gap: .35rem 1.25rem; margin: .45rem 0 0; padding-left: 1.2rem; }
.step-save-status { display: block; margin-top: .15rem; color: var(--muted); font-size: .72rem; font-style: normal; font-weight: 600; }
.logbook-step-button.completed .step-save-status { color: var(--green); }
.step-guidance { margin: 1rem 0 0; padding: .75rem 1rem; border: 1px solid var(--line); border-radius: .7rem; background: var(--paper); color: var(--ink); }
.step-guidance[data-state="pending"], .step-guidance[data-state="unsaved"] { border-color: var(--warning, #b7791f); }
.step-guidance[data-state="saved"] { border-color: var(--green); background: var(--green-light); }
</style>
