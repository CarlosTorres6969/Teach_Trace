<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { api } from '../api';
import { auth } from '../auth';
import type { AcademicClass, Activity, Criterion, Rubric } from '../types';

const classes = ref<AcademicClass[]>([]);
const activities = ref<Activity[]>([]);
const rubrics = ref<Rubric[]>([]);
const error = ref('');
const message = ref('');
const section = ref<'classes' | 'activities' | 'rubrics'>('classes');
const classForm = reactive({ name: '', subject: '', code: '', period: '' });
const enrollmentEmails = reactive<Record<number, string>>({});
const activityForm = reactive({ title: '', classId: 0, dueDate: '', activityType: '' });
const outcomes = reactive<Record<number, string>>({});
const selectedRubrics = reactive<Record<number, number | undefined>>({});
const rubricName = ref('');
const criteria = ref<Criterion[]>(emptyRubric());

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
  await act('Clase creada', async () => {
    await api('/teacher/classes', { method: 'POST', body: JSON.stringify(classForm) });
    Object.assign(classForm, { name: '', subject: '', code: '', period: '' });
    await load();
  });
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

async function createActivity() {
  await act('Actividad creada', async () => {
    await api('/teacher/activities', { method: 'POST', body: JSON.stringify(activityForm) });
    Object.assign(activityForm, { title: '', classId: 0, dueDate: '', activityType: '' });
    await load();
  });
}

async function saveOutcomes(activityId: number) {
  const learningOutcomes = outcomes[activityId].split('\n').map((item) => item.trim()).filter(Boolean);
  await act('Resultados de aprendizaje actualizados', () => api(`/teacher/activities/${activityId}/learning-outcomes`, {
    method: 'PUT', body: JSON.stringify({ learningOutcomes }),
  }));
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

async function act(success: string, action: () => Promise<unknown>) {
  error.value = ''; message.value = '';
  try { await action(); message.value = success; }
  catch (cause) { showError(cause); }
}

function showError(cause: unknown) {
  error.value = cause instanceof Error ? cause.message : 'No fue posible completar la operación';
}

onMounted(load);
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
      <form class="panel form-grid" @submit.prevent="createClass">
        <div class="span-2"><h2>Nueva clase</h2><p class="muted">Define el grupo académico antes de crear actividades o matricular estudiantes.</p></div>
        <label>Nombre del grupo<input v-model="classForm.name" required maxlength="120" /></label>
        <label>Asignatura<input v-model="classForm.subject" required maxlength="120" /></label>
        <label>Código<input v-model="classForm.code" required maxlength="30" /></label>
        <label>Periodo académico<input v-model="classForm.period" required maxlength="40" /></label>
        <button class="button primary span-2">Crear clase</button>
      </form>
      <section class="section-block">
        <div class="section-title"><h2>Clases configuradas</h2><span>{{ classes.length }}</span></div>
        <article v-for="academicClass in classes" :key="academicClass.id" class="panel activity-editor">
          <div class="card-topline">
            <div><span class="eyebrow">{{ academicClass.code }} · {{ academicClass.period }}</span><h3>{{ academicClass.name }}</h3></div>
            <span class="status">{{ academicClass.studentCount }} estudiante(s)</span>
          </div>
          <p class="muted">{{ academicClass.subject }}</p>
          <div v-if="academicClass.students.length" class="roster-list">
            <span v-for="student in academicClass.students" :key="student.id">
              <strong>{{ student.name }}</strong> · {{ student.email }}
            </span>
          </div>
          <div class="association-row">
            <label>Correo institucional del estudiante
              <input v-model="enrollmentEmails[academicClass.id]" type="email" placeholder="estudiante@unah.edu.hn" />
            </label>
            <button class="button secondary" type="button" @click="enrollStudent(academicClass.id)">Matricular</button>
          </div>
        </article>
      </section>
    </template>

    <template v-else-if="section === 'activities'">
      <form class="panel form-grid" @submit.prevent="createActivity">
        <div class="span-2"><h2>Nueva actividad</h2><p class="muted">Define la información básica que verá el estudiante.</p></div>
        <label>Título<input v-model="activityForm.title" required maxlength="160" /></label>
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
        <button class="button primary span-2">Crear actividad</button>
      </form>

      <section class="section-block">
        <div class="section-title"><h2>Actividades configuradas</h2><span>{{ activities.length }}</span></div>
        <article v-for="activity in activities" :key="activity.id" class="panel activity-editor">
          <div class="card-topline">
            <div><span class="eyebrow">{{ activity.academicClass?.code }} · {{ activity.activityType }}</span><h3>{{ activity.title }}</h3></div>
            <RouterLink class="button secondary" :to="`/teacher/activities/${activity.id}/submissions`">Ver entregas</RouterLink>
          </div>
          <p class="muted">Fecha: {{ activity.dueDate }}</p>
          <label>Resultados de aprendizaje — uno por línea
            <textarea v-model="outcomes[activity.id]" rows="3" />
          </label>
          <button class="button secondary" type="button" @click="saveOutcomes(activity.id)">Guardar resultados</button>
          <div class="association-row">
            <label>Rúbrica asociada
              <select v-model="selectedRubrics[activity.id]">
                <option :value="undefined">Selecciona una rúbrica</option>
                <option v-for="rubric in rubrics" :key="rubric.id" :value="rubric.id">{{ rubric.name }}</option>
              </select>
            </label>
            <button class="button secondary" type="button" @click="associateRubric(activity.id)">Asociar</button>
          </div>
        </article>
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
  </main>
</template>
