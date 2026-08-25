<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import readXlsxFile from 'read-excel-file';
import { api } from '../api';
import { auth } from '../auth';
import {
  extractEnrollmentEmails,
  MAX_ENROLLMENT_FILE_SIZE,
} from '../excel-enrollments';
import type { AcademicClass, Activity, Criterion, Rubric } from '../types';

const classes = ref<AcademicClass[]>([]);
const activities = ref<Activity[]>([]);
const rubrics = ref<Rubric[]>([]);
const error = ref('');
const message = ref('');
const section = ref<'classes' | 'activities' | 'rubrics'>('classes');
const classForm = reactive({ name: '', subject: '', code: '', period: '' });
const enrollmentEmails = reactive<Record<number, string>>({});
const activityForm = reactive({
  title: '',
  classId: 0,
  dueDate: '',
  activityType: '',
  evaluationPhase: 'pilot' as 'baseline' | 'pilot',
});
const outcomes = reactive<Record<number, string>>({});
const selectedRubrics = reactive<Record<number, number | undefined>>({});
const rubricName = ref('');
const criteria = ref<Criterion[]>(emptyRubric());
const MAX_LEARNING_OUTCOMES = 20;
const MAX_LEARNING_OUTCOME_LENGTH = 500;
const MAX_LEARNING_OUTCOMES_TEXT_LENGTH =
  MAX_LEARNING_OUTCOMES * MAX_LEARNING_OUTCOME_LENGTH + MAX_LEARNING_OUTCOMES - 1;
type TeacherModal = 'create-class' | 'class-detail' | 'create-activity' | 'activity-detail' | null;
type EnrollmentMode = 'excel' | 'individual';
type BulkEnrollmentResult = {
  processedCount: number;
  enrolledCount: number;
  alreadyEnrolledCount: number;
  notFoundEmails: string[];
};
const activeModal = ref<TeacherModal>(null);
const selectedClassId = ref<number | null>(null);
const selectedActivityId = ref<number | null>(null);
const enrollmentMode = ref<EnrollmentMode>('excel');
const selectedEnrollmentFile = ref<File | null>(null);
const bulkEnrollmentResult = ref<BulkEnrollmentResult | null>(null);
const bulkEnrollmentBusy = ref(false);
const selectedClass = computed(
  () => classes.value.find((academicClass) => academicClass.id === selectedClassId.value) ?? null,
);
const selectedActivity = computed(
  () => activities.value.find((activity) => activity.id === selectedActivityId.value) ?? null,
);

function emptyCriterion(): Criterion {
  return { name: '', dimension: '', descriptors: { level1: '', level2: '', level3: '', level4: '' } };
}

function emptyRubric(): Criterion[] {
  return Array.from({ length: 7 }, () => emptyCriterion());
}

async function load() {
  try {
    [classes.value, activities.value, rubrics.value] = await Promise.all([
      api<AcademicClass[]>('/teacher/classes'),
      api<Activity[]>('/teacher/activities'),
      api<Rubric[]>('/teacher/rubrics'),
    ]);
    activities.value.forEach((activity) => {
      outcomes[activity.id] = (activity.learningOutcomes ?? []).join('\n');
      selectedRubrics[activity.id] = activity.rubric?.id;
    });
  } catch (cause) { showError(cause); }
}

async function createClass() {
  const created = await act('Clase creada', async () => {
    await api('/teacher/classes', { method: 'POST', body: JSON.stringify(classForm) });
    Object.assign(classForm, { name: '', subject: '', code: '', period: '' });
    await load();
  });
  if (created) closeModal();
}

async function enrollStudent(classId: number) {
  const email = enrollmentEmails[classId]?.trim();
  if (!email) return;
  await act('Estudiante matriculado', async () => {
    await api(`/teacher/classes/${classId}/enrollments`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    enrollmentEmails[classId] = '';
    await load();
  });
}

function selectEnrollmentFile(event: Event) {
  clearFeedback();
  bulkEnrollmentResult.value = null;
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  if (!file) {
    selectedEnrollmentFile.value = null;
    return;
  }
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    selectedEnrollmentFile.value = null;
    input.value = '';
    error.value = 'Selecciona un archivo de Excel con extensión .xlsx.';
    return;
  }
  if (file.size > MAX_ENROLLMENT_FILE_SIZE) {
    selectedEnrollmentFile.value = null;
    input.value = '';
    error.value = 'El archivo no puede superar los 5 MB.';
    return;
  }
  selectedEnrollmentFile.value = file;
}

async function importEnrollments(classId: number) {
  if (!selectedEnrollmentFile.value || bulkEnrollmentBusy.value) return;
  clearFeedback();
  bulkEnrollmentBusy.value = true;
  try {
    const rows = await readXlsxFile(selectedEnrollmentFile.value);
    const emails = extractEnrollmentEmails(rows);
    bulkEnrollmentResult.value = await api<BulkEnrollmentResult>(
      `/teacher/classes/${classId}/enrollments/bulk`,
      { method: 'POST', body: JSON.stringify({ emails }) },
    );
    message.value = 'Importación de matrícula completada';
    await load();
  } catch (cause) {
    showError(cause);
  } finally {
    bulkEnrollmentBusy.value = false;
  }
}

function resetEnrollmentImport() {
  enrollmentMode.value = 'excel';
  selectedEnrollmentFile.value = null;
  bulkEnrollmentResult.value = null;
}

function formatFileSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function createActivity() {
  const created = await act('Actividad creada', async () => {
    await api('/teacher/activities', { method: 'POST', body: JSON.stringify(activityForm) });
    Object.assign(activityForm, {
      title: '',
      classId: 0,
      dueDate: '',
      activityType: '',
      evaluationPhase: 'pilot',
    });
    await load();
  });
  if (created) closeModal();
}

async function saveOutcomes(activityId: number) {
  await act('Resultados de aprendizaje actualizados', async () => {
    const learningOutcomes = (outcomes[activityId] ?? '')
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
    if (!learningOutcomes.length) {
      throw new Error('Agrega al menos un resultado de aprendizaje válido.');
    }
    if (learningOutcomes.length > MAX_LEARNING_OUTCOMES) {
      throw new Error(`Solo puedes registrar hasta ${MAX_LEARNING_OUTCOMES} resultados.`);
    }
    const invalidIndex = learningOutcomes.findIndex(
      (outcome) => outcome.length > MAX_LEARNING_OUTCOME_LENGTH,
    );
    if (invalidIndex >= 0) {
      throw new Error(
        `El resultado ${invalidIndex + 1} supera los ${MAX_LEARNING_OUTCOME_LENGTH} caracteres.`,
      );
    }
    await api(`/teacher/activities/${activityId}/learning-outcomes`, {
      method: 'PUT', body: JSON.stringify({ learningOutcomes }),
    });
    await load();
  });
}

async function associateRubric(activityId: number) {
  const rubricId = selectedRubrics[activityId];
  if (!rubricId) return;
  await act('Rúbrica asociada a la actividad', async () => {
    await api(`/teacher/activities/${activityId}/rubric`, { method: 'PUT', body: JSON.stringify({ rubricId }) });
    await load();
  });
}

async function createRubric() {
  await act('Rúbrica creada', async () => {
    await api('/teacher/rubrics', {
      method: 'POST', body: JSON.stringify({ name: rubricName.value, criteria: criteria.value }),
    });
    rubricName.value = '';
    criteria.value = emptyRubric();
    await load();
  });
}

async function act(success: string, action: () => Promise<unknown>): Promise<boolean> {
  error.value = ''; message.value = '';
  try {
    await action();
    message.value = success;
    return true;
  } catch (cause) {
    showError(cause);
    return false;
  }
}

function showError(cause: unknown) {
  error.value = cause instanceof Error ? cause.message : 'No fue posible completar la operación';
}

function classActivityCount(classId: number) {
  return activities.value.filter((activity) => activity.academicClass?.id === classId).length;
}

function openCreateClass() {
  clearFeedback();
  activeModal.value = 'create-class';
}

function openClassDetail(classId: number) {
  clearFeedback();
  resetEnrollmentImport();
  selectedClassId.value = classId;
  activeModal.value = 'class-detail';
}

function openCreateActivity() {
  clearFeedback();
  activeModal.value = 'create-activity';
}

function openActivityDetail(activityId: number) {
  clearFeedback();
  selectedActivityId.value = activityId;
  activeModal.value = 'activity-detail';
}

function closeModal() {
  activeModal.value = null;
}

function clearFeedback() {
  error.value = '';
  message.value = '';
}

function handleEscape(event: KeyboardEvent) {
  if (event.key === 'Escape' && activeModal.value) closeModal();
}

watch(activeModal, (modal) => {
  document.body.classList.toggle('modal-open', Boolean(modal));
});

onMounted(() => {
  window.addEventListener('keydown', handleEscape);
  void load();
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleEscape);
  document.body.classList.remove('modal-open');
});
</script>

<template>
  <main class="page">
    <section class="page-heading">
      <div><span class="eyebrow">Panel docente</span><h1>Hola, {{ auth.user?.name }}</h1></div>
      <p>Configura las actividades y las rúbricas del piloto.</p>
    </section>
    <nav class="tabs teacher-tabs">
      <button :class="{ active: section === 'classes' }" @click="section = 'classes'">Clases y matrícula</button>
      <button :class="{ active: section === 'activities' }" @click="section = 'activities'">Actividades</button>
      <button :class="{ active: section === 'rubrics' }" @click="section = 'rubrics'">Rúbricas</button>
    </nav>
    <p v-if="message" class="alert success">{{ message }}</p>
    <p v-if="error" class="alert error">{{ error }}</p>

    <template v-if="section === 'classes'">
      <section class="section-block catalog-section">
        <div class="management-toolbar">
          <div>
            <span class="eyebrow">Organización académica</span>
            <div class="section-title"><h2>Mis clases</h2><span>{{ classes.length }}</span></div>
            <p class="muted">Consulta cada grupo, su matrícula y las actividades asignadas.</p>
          </div>
          <button class="button primary" type="button" @click="openCreateClass">Nueva clase</button>
        </div>

        <div v-if="classes.length" class="teacher-catalog-grid">
          <article v-for="academicClass in classes" :key="academicClass.id" class="teacher-catalog-card">
            <div class="catalog-card-header">
              <span class="catalog-code">{{ academicClass.code }}</span>
              <span class="status">{{ academicClass.period }}</span>
            </div>
            <div class="catalog-card-content">
              <p class="eyebrow">{{ academicClass.subject }}</p>
              <h3>{{ academicClass.name }}</h3>
            </div>
            <div class="catalog-stats" aria-label="Resumen de la clase">
              <div><strong>{{ academicClass.studentCount }}</strong><span>Estudiantes</span></div>
              <div><strong>{{ classActivityCount(academicClass.id) }}</strong><span>Actividades</span></div>
            </div>
            <button class="button secondary full" type="button" @click="openClassDetail(academicClass.id)">
              Ver clase y matrícula
            </button>
          </article>
        </div>
        <div v-else class="panel empty-state">
          <h3>Aún no tienes clases</h3>
          <p>Crea tu primer grupo para comenzar a matricular estudiantes y preparar actividades.</p>
          <button class="button primary" type="button" @click="openCreateClass">Crear primera clase</button>
        </div>
      </section>
    </template>

    <template v-else-if="section === 'activities'">
      <section class="section-block catalog-section">
        <div class="management-toolbar">
          <div>
            <span class="eyebrow">Planificación del piloto</span>
            <div class="section-title"><h2>Mis actividades</h2><span>{{ activities.length }}</span></div>
            <p class="muted">Revisa la configuración de cada actividad y accede a sus entregas.</p>
          </div>
          <button class="button primary" type="button" :disabled="!classes.length" @click="openCreateActivity">
            Nueva actividad
          </button>
        </div>

        <p v-if="!classes.length" class="alert error">
          Primero debes crear una clase antes de registrar actividades.
        </p>
        <div v-if="activities.length" class="teacher-catalog-grid">
          <article v-for="activity in activities" :key="activity.id" class="teacher-catalog-card activity-catalog-card">
            <div class="catalog-card-header">
              <span class="catalog-code">{{ activity.academicClass?.code }}</span>
              <span class="status">{{ activity.evaluationPhase === 'baseline' ? 'Línea base' : 'Piloto' }}</span>
            </div>
            <div class="catalog-card-content">
              <p class="eyebrow">{{ activity.activityType }}</p>
              <h3>{{ activity.title }}</h3>
              <p class="muted">Entrega: {{ activity.dueDate }}</p>
            </div>
            <div class="catalog-badges">
              <span>{{ activity.learningOutcomes?.length ?? 0 }} resultado(s)</span>
              <span :class="{ pending: !activity.rubric }">{{ activity.rubric?.name ?? 'Sin rúbrica' }}</span>
            </div>
            <p v-if="activity.manualEvaluationRequired" class="catalog-warning">Requiere evaluación manual</p>
            <div class="catalog-actions">
              <button class="button secondary" type="button" @click="openActivityDetail(activity.id)">Configurar</button>
              <RouterLink class="button primary" :to="`/teacher/activities/${activity.id}/submissions`">Ver entregas</RouterLink>
            </div>
          </article>
        </div>
        <div v-else class="panel empty-state">
          <h3>Aún no tienes actividades</h3>
          <p>Cuando tengas una clase, crea aquí la primera actividad del piloto.</p>
          <button v-if="classes.length" class="button primary" type="button" @click="openCreateActivity">
            Crear primera actividad
          </button>
        </div>
      </section>
    </template>

    <template v-else>
      <form class="panel form-stack" @submit.prevent="createRubric">
        <div><h2>Nueva rúbrica</h2><p class="muted">Completa exactamente las siete dimensiones y sus descriptores para los niveles 1–4.</p></div>
        <label>Nombre de la rúbrica<input v-model="rubricName" required maxlength="160" /></label>
        <fieldset v-for="(criterion, index) in criteria" :key="index" class="criterion-box">
          <legend>Criterio {{ index + 1 }}</legend>
          <div class="form-grid">
            <label>Nombre<input v-model="criterion.name" required maxlength="120" /></label>
            <label>Dimensión<input v-model="criterion.dimension" required maxlength="120" /></label>
            <label>Nivel 1<textarea v-model="criterion.descriptors.level1" rows="2" required /></label>
            <label>Nivel 2<textarea v-model="criterion.descriptors.level2" rows="2" required /></label>
            <label>Nivel 3<textarea v-model="criterion.descriptors.level3" rows="2" required /></label>
            <label>Nivel 4<textarea v-model="criterion.descriptors.level4" rows="2" required /></label>
          </div>
        </fieldset>
        <button class="button primary">Crear rúbrica</button>
      </form>
      <section class="section-block">
        <div class="section-title"><h2>Rúbricas disponibles</h2><span>{{ rubrics.length }}</span></div>
        <article v-for="rubric in rubrics" :key="rubric.id" class="panel">
          <h3>{{ rubric.name }}</h3><p class="muted">{{ rubric.criteria.length }} criterio(s)</p>
          <details v-for="(criterion, index) in rubric.criteria" :key="index">
            <summary>{{ criterion.name }} — {{ criterion.dimension }}</summary>
            <ol><li v-for="level in 4" :key="level">Nivel {{ level }}: {{ criterion.descriptors[`level${level}` as keyof typeof criterion.descriptors] }}</li></ol>
          </details>
        </article>
      </section>
    </template>

    <div v-if="activeModal === 'create-class'" class="modal-backdrop" @click.self="closeModal">
      <section class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="create-class-title">
        <header class="modal-header">
          <div>
            <span class="eyebrow">Nueva clase</span>
            <h2 id="create-class-title">Configura el grupo</h2>
          </div>
          <button class="modal-close" type="button" aria-label="Cerrar modal" @click="closeModal">×</button>
        </header>
        <form class="modal-body form-grid" @submit.prevent="createClass">
          <p class="muted span-2">Define el grupo académico antes de crear actividades o matricular estudiantes.</p>
          <p v-if="error" class="alert error span-2">{{ error }}</p>
          <label>Nombre del grupo<input v-model="classForm.name" required maxlength="120" autofocus /></label>
          <label>Asignatura<input v-model="classForm.subject" required maxlength="120" /></label>
          <label>Código<input v-model="classForm.code" required maxlength="30" /></label>
          <label>Periodo académico<input v-model="classForm.period" required maxlength="40" /></label>
          <div class="modal-actions span-2">
            <button class="button secondary" type="button" @click="closeModal">Cancelar</button>
            <button class="button primary">Crear clase</button>
          </div>
        </form>
      </section>
    </div>

    <div v-if="activeModal === 'class-detail' && selectedClass" class="modal-backdrop" @click.self="closeModal">
      <section class="modal-dialog wide" role="dialog" aria-modal="true" aria-labelledby="class-detail-title">
        <header class="modal-header">
          <div>
            <span class="eyebrow">{{ selectedClass.code }} · {{ selectedClass.period }}</span>
            <h2 id="class-detail-title">{{ selectedClass.name }}</h2>
            <p class="muted">{{ selectedClass.subject }}</p>
          </div>
          <button class="modal-close" type="button" aria-label="Cerrar modal" @click="closeModal">×</button>
        </header>
        <div class="modal-body">
          <div class="class-summary-grid">
            <div><strong>{{ selectedClass.studentCount }}</strong><span>Estudiantes matriculados</span></div>
            <div><strong>{{ classActivityCount(selectedClass.id) }}</strong><span>Actividades asignadas</span></div>
          </div>

          <section class="modal-section">
            <div class="section-title"><h3>Estudiantes</h3><span>{{ selectedClass.studentCount }}</span></div>
            <div v-if="selectedClass.students.length" class="roster-list roster-modal-list">
              <div v-for="student in selectedClass.students" :key="student.id">
                <span class="student-avatar" aria-hidden="true">{{ student.name.charAt(0).toUpperCase() }}</span>
                <span><strong>{{ student.name }}</strong><small>{{ student.email }}</small></span>
              </div>
            </div>
            <p v-else class="empty-inline">Esta clase todavía no tiene estudiantes matriculados.</p>
          </section>

          <section class="modal-section enrollment-form">
            <div>
              <h3>Matricular estudiantes</h3>
              <p class="muted">Importa un grupo desde Excel o agrega una cuenta individual.</p>
            </div>
            <div class="enrollment-mode-tabs" aria-label="Método de matrícula">
              <button
                type="button"
                :class="{ active: enrollmentMode === 'excel' }"
                @click="enrollmentMode = 'excel'; clearFeedback()"
              >
                Desde Excel
              </button>
              <button
                type="button"
                :class="{ active: enrollmentMode === 'individual' }"
                @click="enrollmentMode = 'individual'; clearFeedback()"
              >
                Individual
              </button>
            </div>
            <p v-if="error" class="alert error">{{ error }}</p>

            <div v-if="enrollmentMode === 'excel'" class="excel-enrollment">
              <div class="excel-format-note">
                <strong>Formato del archivo</strong>
                <span>Archivo <code>.xlsx</code>, primera hoja y una columna llamada <code>correo</code>.</span>
                <small>También se aceptan los encabezados “email” y “correo institucional”. Máximo 500 estudiantes.</small>
              </div>
              <label class="excel-file-picker">
                <input
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  @change="selectEnrollmentFile"
                />
                <span class="excel-file-icon" aria-hidden="true">XLSX</span>
                <span v-if="selectedEnrollmentFile">
                  <strong>{{ selectedEnrollmentFile.name }}</strong>
                  <small>{{ formatFileSize(selectedEnrollmentFile.size) }} · Listo para importar</small>
                </span>
                <span v-else>
                  <strong>Seleccionar archivo de Excel</strong>
                  <small>Haz clic para buscar el archivo en tu dispositivo · máximo 5 MB</small>
                </span>
              </label>

              <button
                class="button primary full"
                type="button"
                :disabled="!selectedEnrollmentFile || bulkEnrollmentBusy"
                @click="importEnrollments(selectedClass.id)"
              >
                {{ bulkEnrollmentBusy ? 'Procesando archivo…' : 'Importar y matricular' }}
              </button>

              <div v-if="bulkEnrollmentResult" class="bulk-enrollment-result">
                <strong>Importación completada</strong>
                <div class="bulk-result-stats">
                  <span><b>{{ bulkEnrollmentResult.enrolledCount }}</b> matriculados</span>
                  <span><b>{{ bulkEnrollmentResult.alreadyEnrolledCount }}</b> ya estaban</span>
                  <span :class="{ warning: bulkEnrollmentResult.notFoundEmails.length }">
                    <b>{{ bulkEnrollmentResult.notFoundEmails.length }}</b> no encontrados
                  </span>
                </div>
                <details v-if="bulkEnrollmentResult.notFoundEmails.length">
                  <summary>Ver correos no matriculados</summary>
                  <ul>
                    <li v-for="email in bulkEnrollmentResult.notFoundEmails" :key="email">{{ email }}</li>
                  </ul>
                </details>
              </div>
            </div>

            <form v-else class="individual-enrollment" @submit.prevent="enrollStudent(selectedClass.id)">
              <div class="association-row">
                <label>Correo institucional
                  <input
                    v-model="enrollmentEmails[selectedClass.id]"
                    type="email"
                    placeholder="estudiante@unah.edu.hn"
                    required
                  />
                </label>
                <button class="button primary">Matricular</button>
              </div>
            </form>
          </section>
        </div>
      </section>
    </div>

    <div v-if="activeModal === 'create-activity'" class="modal-backdrop" @click.self="closeModal">
      <section class="modal-dialog wide" role="dialog" aria-modal="true" aria-labelledby="create-activity-title">
        <header class="modal-header">
          <div>
            <span class="eyebrow">Nueva actividad</span>
            <h2 id="create-activity-title">Información básica</h2>
          </div>
          <button class="modal-close" type="button" aria-label="Cerrar modal" @click="closeModal">×</button>
        </header>
        <form class="modal-body form-grid" @submit.prevent="createActivity">
          <p class="muted span-2">Define la actividad que verá el estudiante durante el piloto.</p>
          <p v-if="error" class="alert error span-2">{{ error }}</p>
          <label>Título<input v-model="activityForm.title" required maxlength="160" autofocus /></label>
          <label>Clase
            <select v-model.number="activityForm.classId" required>
              <option :value="0" disabled>Selecciona una clase</option>
              <option v-for="academicClass in classes" :key="academicClass.id" :value="academicClass.id">
                {{ academicClass.code }} — {{ academicClass.name }}
              </option>
            </select>
          </label>
          <label>Fecha de entrega<input v-model="activityForm.dueDate" type="date" required /></label>
          <label>Tipo<input v-model="activityForm.activityType" placeholder="Ensayo, proyecto…" required maxlength="80" /></label>
          <label>Fase de evaluación
            <select v-model="activityForm.evaluationPhase" required>
              <option value="baseline">Línea base interna</option>
              <option value="pilot">Piloto</option>
            </select>
          </label>
          <div class="modal-actions span-2">
            <button class="button secondary" type="button" @click="closeModal">Cancelar</button>
            <button class="button primary">Crear actividad</button>
          </div>
        </form>
      </section>
    </div>

    <div v-if="activeModal === 'activity-detail' && selectedActivity" class="modal-backdrop" @click.self="closeModal">
      <section class="modal-dialog wide" role="dialog" aria-modal="true" aria-labelledby="activity-detail-title">
        <header class="modal-header">
          <div>
            <span class="eyebrow">
              {{ selectedActivity.academicClass?.code }} · {{ selectedActivity.activityType }} ·
              {{ selectedActivity.evaluationPhase === 'baseline' ? 'Línea base' : 'Piloto' }}
            </span>
            <h2 id="activity-detail-title">{{ selectedActivity.title }}</h2>
            <p class="muted">Fecha de entrega: {{ selectedActivity.dueDate }}</p>
          </div>
          <button class="modal-close" type="button" aria-label="Cerrar modal" @click="closeModal">×</button>
        </header>
        <div class="modal-body">
          <p v-if="error" class="alert error">{{ error }}</p>
          <p v-if="message" class="alert success">{{ message }}</p>
          <p v-if="selectedActivity.manualEvaluationRequired" class="alert error">
            Esta actividad requiere evaluación manual.
          </p>

          <section class="modal-section">
            <div>
              <h3>Resultados de aprendizaje</h3>
              <p class="muted">Escribe un resultado por línea para establecer qué se evaluará.</p>
            </div>
            <label>Resultados — uno por línea
              <textarea
                v-model="outcomes[selectedActivity.id]"
                rows="6"
                :maxlength="MAX_LEARNING_OUTCOMES_TEXT_LENGTH"
                required
              />
              <small class="muted">
                Hasta {{ MAX_LEARNING_OUTCOMES }} resultados y {{ MAX_LEARNING_OUTCOME_LENGTH }} caracteres por resultado.
              </small>
            </label>
            <button class="button secondary" type="button" @click="saveOutcomes(selectedActivity.id)">
              Guardar resultados
            </button>
          </section>

          <section class="modal-section">
            <div>
              <h3>Rúbrica de evaluación</h3>
              <p class="muted">Selecciona la rúbrica cuyos criterios se utilizarán para evaluar las entregas.</p>
            </div>
            <div class="association-row">
              <label>Rúbrica asociada
                <select v-model="selectedRubrics[selectedActivity.id]">
                  <option :value="undefined">Selecciona una rúbrica</option>
                  <option
                    v-for="rubric in rubrics"
                    :key="rubric.id"
                    :value="rubric.id"
                    :disabled="rubric.activityId != null && rubric.activityId !== selectedActivity.id"
                  >
                    {{ rubric.name }}{{ rubric.activityId != null && rubric.activityId !== selectedActivity.id ? ' — asociada a otra actividad' : '' }}
                  </option>
                </select>
              </label>
              <button
                class="button secondary"
                type="button"
                :disabled="!selectedRubrics[selectedActivity.id]"
                @click="associateRubric(selectedActivity.id)"
              >
                Asociar
              </button>
            </div>
          </section>

          <div class="modal-actions">
            <button class="button secondary" type="button" @click="closeModal">Cerrar</button>
            <RouterLink class="button primary" :to="`/teacher/activities/${selectedActivity.id}/submissions`">
              Ver entregas
            </RouterLink>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>
