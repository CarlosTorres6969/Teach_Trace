<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../api';

const route = useRoute();
const activityId = Number(route.params.id);
const tab = ref<'logbook' | 'submission'>('logbook');
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
const currentLogbookStep = ref(0);
const savingLogbook = ref(false);
const activeLogbookStep = computed(() => logbookSteps[currentLogbookStep.value]);
const completedLogbookSteps = computed(() =>
  logbookSteps.map((step) => logbook[step.key].trim().length > 0),
);
const completedLogbookStepCount = computed(
  () => completedLogbookSteps.value.filter(Boolean).length,
);
const isLastLogbookStep = computed(
  () => currentLogbookStep.value === logbookSteps.length - 1,
);
const declaration = reactive({ toolName: '', usageLevel: 1, purpose: '', promptSummary: '' });
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
    Object.assign(logbook, {
      initialIdeas: logbookData.initialIdeas ?? '',
      prompts: logbookData.prompts ?? '',
      validationsAndDecisions: logbookData.validationsAndDecisions ?? '',
      finalReflection: logbookData.finalReflection ?? '',
    });
    Object.assign(declaration, declarationData);
    Object.assign(submission, submissionData);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo cargar la actividad';
  } finally {
    loading.value = false;
  }
}

function openLogbookStep(index: number) {
  currentLogbookStep.value = index;
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
  const saved = await saveLogbookProgress(
    isLastLogbookStep.value ? 'Bitácora actualizada' : 'Paso guardado correctamente',
  );
  if (saved && !isLastLogbookStep.value) currentLogbookStep.value += 1;
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
  message.value = '';
  error.value = '';
  const form = new FormData();
  form.set('productText', submission.productText);
  form.set('productUrl', submission.productUrl);
  form.set('toolName', declaration.toolName);
  form.set('usageLevel', String(declaration.usageLevel));
  form.set('purpose', declaration.purpose);
  form.set('promptSummary', declaration.promptSummary);
  if (selectedFile.value) form.set('file', selectedFile.value);
  try {
    const result = await api<Record<string, string | null>>(
      `/student/activities/${activityId}/submission`,
      { method: 'PUT', body: form },
    );
    Object.assign(submission, result);
    selectedFile.value = null;
    message.value = 'Entrega y declaración de IA guardadas correctamente';
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No fue posible guardar la entrega';
  }
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
        <button :class="{ active: tab === 'submission' }" @click="tab = 'submission'">Entrega y declaración de IA</button>
      </nav>
      <p v-if="message" class="alert success">{{ message }}</p>
      <p v-if="error" class="alert error">{{ error }}</p>

      <form v-if="tab === 'logbook'" class="panel logbook-wizard" @submit.prevent="submitLogbookStep">
        <div class="logbook-heading">
          <div>
            <span class="eyebrow">Proceso guiado</span>
            <h2>Bitácora del proceso</h2>
            <p class="muted">Avanza paso a paso. Puedes regresar y actualizar cualquier sección.</p>
          </div>
          <span class="logbook-progress-label">
            {{ completedLogbookStepCount }} de {{ logbookSteps.length }} con contenido
          </span>
        </div>

        <div
          class="logbook-progress"
          role="progressbar"
          :aria-valuenow="currentLogbookStep + 1"
          aria-valuemin="1"
          :aria-valuemax="logbookSteps.length"
          :aria-label="`Paso ${currentLogbookStep + 1} de ${logbookSteps.length}`"
        >
          <span :style="{ width: `${((currentLogbookStep + 1) / logbookSteps.length) * 100}%` }" />
        </div>

        <ol class="logbook-steps" aria-label="Pasos de la bitácora">
          <li v-for="(step, index) in logbookSteps" :key="step.key">
            <button
              type="button"
              class="logbook-step-button"
              :class="{
                active: currentLogbookStep === index,
                completed: completedLogbookSteps[index],
              }"
              :aria-current="currentLogbookStep === index ? 'step' : undefined"
              @click="openLogbookStep(index)"
            >
              <span class="logbook-step-number">
                {{ completedLogbookSteps[index] ? '✓' : index + 1 }}
              </span>
              <span>
                <small>Paso {{ index + 1 }}</small>
                <strong>{{ step.shortTitle }}</strong>
              </span>
            </button>
          </li>
        </ol>

        <section class="logbook-step-content">
          <span class="eyebrow">Paso {{ currentLogbookStep + 1 }} de {{ logbookSteps.length }}</span>
          <h3>{{ activeLogbookStep.title }}</h3>
          <p class="muted">{{ activeLogbookStep.description }}</p>
          <label>
            Tu registro
            <textarea
              :key="activeLogbookStep.key"
              v-model="logbook[activeLogbookStep.key]"
              rows="9"
              :maxlength="activeLogbookStep.maxLength"
              :placeholder="activeLogbookStep.placeholder"
              autofocus
            />
            <small class="character-count">
              {{ logbook[activeLogbookStep.key].length.toLocaleString() }} /
              {{ activeLogbookStep.maxLength.toLocaleString() }} caracteres
            </small>
          </label>
        </section>

        <div class="logbook-actions">
          <button
            v-if="currentLogbookStep > 0"
            class="button secondary"
            type="button"
            :disabled="savingLogbook"
            @click="openLogbookStep(currentLogbookStep - 1)"
          >
            ← Anterior
          </button>
          <span v-else />
          <div>
            <button
              class="button secondary"
              type="button"
              :disabled="savingLogbook"
              @click="saveWithoutAdvancing"
            >
              Guardar progreso
            </button>
            <button class="button primary" :disabled="savingLogbook">
              {{
                savingLogbook
                  ? 'Guardando…'
                  : isLastLogbookStep
                    ? 'Guardar bitácora'
                    : 'Guardar y continuar →'
              }}
            </button>
          </div>
        </div>
      </form>

      <form v-else class="panel form-stack" @submit.prevent="submitEvidence">
        <div class="card-topline"><div><h2>Producto final y declaración de IA</h2><p class="muted">Ambos se guardan juntos como una sola entrega trazable.</p></div><span class="status" :data-status="submission.status">{{ statusText }}</span></div>
        <h3>Producto académico</h3>
        <label>Contenido del producto<textarea v-model="submission.productText" rows="10" maxlength="50000" /></label>
        <label>Enlace complementario<input v-model="submission.productUrl" type="url" placeholder="https://…" maxlength="500" /></label>
        <label>Archivo complementario
          <input type="file" @change="selectFile" />
          <small class="muted">Tamaño máximo: 10 MB.</small>
        </label>
        <p v-if="submission.fileName" class="muted">Archivo guardado: {{ submission.fileName }}</p>
        <p v-if="submission.manualReviewRequired" class="alert error">La entrega quedó marcada para revisión manual.</p>
        <h3>Declaración de uso de IA</h3>
        <label>Herramienta utilizada<input v-model="declaration.toolName" maxlength="120" required /></label>
        <label>Nivel declarado
          <select v-model.number="declaration.usageLevel" required>
            <option :value="1">Nivel 1 — apoyo mínimo</option><option :value="2">Nivel 2 — apoyo moderado</option><option :value="3">Nivel 3 — apoyo significativo</option>
          </select>
        </label>
        <label>Propósito<textarea v-model="declaration.purpose" rows="4" maxlength="5000" required /></label>
        <label>Resumen de prompts<textarea v-model="declaration.promptSummary" rows="5" maxlength="10000" required /></label>
        <p v-if="submission.submittedAt" class="muted">Última entrega: {{ new Date(submission.submittedAt).toLocaleString() }}</p>
        <button class="button primary">{{ submission.status === 'not_submitted' ? 'Realizar entrega' : 'Actualizar entrega' }}</button>
      </form>
    </template>
  </main>
</template>
