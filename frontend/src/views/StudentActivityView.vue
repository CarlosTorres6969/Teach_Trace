<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../api';

const route = useRoute();
const activityId = Number(route.params.id);
const title = ref('Actividad');
const loading = ref(true);
const message = ref('');
const error = ref('');

const logbook = reactive({ initialIdeas: '', prompts: '', validationsAndDecisions: '', finalReflection: '' });
type LogbookField = keyof typeof logbook;
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
    title: 'Prompts utilizados',
    description: 'Registra las instrucciones o preguntas que utilizaste al interactuar con herramientas de IA.',
    placeholder: 'Anota los prompts relevantes y el contexto en que los utilizaste…',
    maxLength: 20000,
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
  promptSummary: '',
});
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
const isSubmissionStep = computed(() => currentStep.value === logbookSteps.length);
const activeStep = computed(() => logbookSteps[currentStep.value]);

const stepCompletion = computed<boolean[]>(() => [
  ...logbookSteps.map((step) => logbook[step.key].trim().length > 0),
  submission.status !== 'not_submitted',
]);
const completedStepCount = computed(() => stepCompletion.value.filter(Boolean).length);
const isLastStep = computed(() => currentStep.value === totalSteps - 1);

const statusText = computed(() => ({
  not_submitted: 'Sin entregar', submitted: 'Entregado', under_review: 'En revisión', evaluated: 'Evaluado',
}[submission.status] ?? submission.status));

async function load() {
  try {
    const [logbookData, declarationData, submissionData] = await Promise.all([
      api<Record<string, string> & { activity: { title: string } }>(`/student/activities/${activityId}/logbook`),
      api<Record<string, string | number | null>>(`/student/activities/${activityId}/ai-declaration`),
      api<Record<string, string> & { activity: { title: string } }>(`/student/activities/${activityId}/submission-status`),
    ]);
    title.value = logbookData.activity.title;
    Object.assign(logbook, {
      initialIdeas: logbookData.initialIdeas ?? '',
      prompts: logbookData.prompts ?? '',
      validationsAndDecisions: logbookData.validationsAndDecisions ?? '',
      finalReflection: logbookData.finalReflection ?? '',
    });
    const loadedUsageLevel = declarationData.usageLevel;
    Object.assign(declaration, declarationData, {
      usageLevel:
        typeof loadedUsageLevel === 'number' && [1, 2, 3].includes(loadedUsageLevel)
          ? loadedUsageLevel
          : '',
    });
    Object.assign(submission, submissionData);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo cargar la actividad';
  } finally {
    loading.value = false;
  }
}

function openStep(index: number) {
  currentStep.value = index;
  message.value = '';
  error.value = '';
}

async function saveLogbookProgress(success: string) {
  savingLogbook.value = true;
  try {
    return (
      (await runSave(success, `/student/activities/${activityId}/logbook`, {
        initialIdeas: logbook.initialIdeas,
        prompts: logbook.prompts,
        validationsAndDecisions: logbook.validationsAndDecisions,
        finalReflection: logbook.finalReflection,
      })) !== null
    );
  } finally {
    savingLogbook.value = false;
  }
}

async function submitLogbookStep() {
  const saved = await saveLogbookProgress('Paso guardado correctamente');
  if (saved && !isLastStep.value) currentStep.value += 1;
}

async function saveWithoutAdvancing() {
  await saveLogbookProgress('Progreso de la bitácora guardado');
}

function selectFile(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0] ?? null;
  if (file && file.size > 10 * 1024 * 1024) {
    error.value = 'El archivo no puede superar 10 MB.';
    target.value = '';
    selectedFile.value = null;
    return;
  }
  error.value = '';
  selectedFile.value = file;
}

async function submitEvidence() {
  if (!submission.productText.trim() && !submission.productUrl.trim() && !selectedFile.value && !submission.fileName) {
    error.value = 'Entrega texto, un enlace o un archivo.';
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
  message.value = '';
  error.value = '';
  submittingEvidence.value = true;
  const form = new FormData();
  form.set('productText', submission.productText);
  form.set('productUrl', submission.productUrl);
  form.set('toolName', declaration.toolName);
  form.set('usageLevel', String(usageLevel));
  form.set('purpose', purpose);
  form.set('promptSummary', declaration.promptSummary);
  if (selectedFile.value) form.set('file', selectedFile.value);
  try {
    const result = await api<Record<string, string | null>>(
      `/student/activities/${activityId}/submission`,
      { method: 'PUT', body: form },
    );
    Object.assign(submission, result);
    selectedFile.value = null;
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
          :aria-valuenow="currentStep + 1"
          aria-valuemin="1"
          :aria-valuemax="totalSteps"
          :aria-label="`Paso ${currentStep + 1} de ${totalSteps}`"
        >
          <span :style="{ width: `${((currentStep + 1) / totalSteps) * 100}%` }" />
        </div>

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
              </span>
            </button>
          </li>
        </ol>

        <section v-if="!isSubmissionStep" class="logbook-step-content">
          <span class="eyebrow">Paso {{ currentStep + 1 }} de {{ totalSteps }}</span>
          <h3>{{ activeStep.title }}</h3>
          <p class="muted">{{ activeStep.description }}</p>
          <label>
            Tu registro
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
            <label>Archivo complementario
              <input type="file" @change="selectFile" />
              <small class="muted">Tamaño máximo: 10 MB.</small>
            </label>
            <p v-if="submission.fileName" class="muted">Archivo guardado: {{ submission.fileName }}</p>
            <p v-if="submission.manualReviewRequired" class="alert error">La entrega quedó marcada para revisión manual.</p>
            <h3>Declaración de uso de IA</h3>
            <label>Herramienta utilizada<input v-model.trim="declaration.toolName" maxlength="120" placeholder="Ej. ChatGPT, Gemini o Copilot" required /></label>
            <label>Nivel declarado
              <select v-model.number="declaration.usageLevel" required>
                <option value="" disabled>Selecciona un nivel</option>
                <option :value="1">Nivel 1 — apoyo mínimo</option><option :value="2">Nivel 2 — apoyo moderado</option><option :value="3">Nivel 3 — apoyo significativo</option>
              </select>
            </label>
            <label>Propósito<textarea v-model.trim="declaration.purpose" rows="3" maxlength="5000" required /></label>
            <label>
              Resumen de prompts
              <span class="field-hint muted">Opcional — registra los prompts más relevantes que usaste.</span>
              <textarea v-model="declaration.promptSummary" rows="4" maxlength="10000" />
              <small class="character-count">
                {{ declaration.promptSummary.length.toLocaleString() }} / 10 000 caracteres
              </small>
            </label>
            <p v-if="submission.submittedAt" class="muted">Última entrega: {{ new Date(submission.submittedAt).toLocaleString() }}</p>
          </div>
        </section>

        <div class="logbook-actions">
          <button
            v-if="currentStep > 0"
            class="button secondary"
            type="button"
            :disabled="savingLogbook || submittingEvidence"
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
              :disabled="savingLogbook"
              @click="saveWithoutAdvancing"
            >
              Guardar progreso
            </button>
            <button class="button primary" :disabled="savingLogbook || submittingEvidence">
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
</style>
