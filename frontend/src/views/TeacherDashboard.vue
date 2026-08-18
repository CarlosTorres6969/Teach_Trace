<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { api } from '../api';
import { auth } from '../auth';
import type { Activity, Criterion, Rubric } from '../types';

const activities = ref<Activity[]>([]);
const rubrics = ref<Rubric[]>([]);
const error = ref('');
const message = ref('');
const section = ref<'activities' | 'rubrics'>('activities');
const activityForm = reactive({ title: '', subject: '', dueDate: '', activityType: '' });
const outcomes = reactive<Record<number, string>>({});
const selectedRubrics = reactive<Record<number, number | undefined>>({});
const rubricName = ref('');
const criteria = ref<Criterion[]>([emptyCriterion()]);

function emptyCriterion(): Criterion {
  return { name: '', dimension: '', descriptors: { level1: '', level2: '', level3: '', level4: '' } };
}

async function load() {
  try {
    [activities.value, rubrics.value] = await Promise.all([
      api<Activity[]>('/teacher/activities'), api<Rubric[]>('/teacher/rubrics'),
    ]);
    activities.value.forEach((activity) => {
      outcomes[activity.id] = (activity.learningOutcomes ?? []).join('\n');
      selectedRubrics[activity.id] = activity.rubric?.id;
    });
  } catch (cause) { showError(cause); }
}

async function createActivity() {
  await act('Actividad creada', async () => {
    await api('/teacher/activities', { method: 'POST', body: JSON.stringify(activityForm) });
    Object.assign(activityForm, { title: '', subject: '', dueDate: '', activityType: '' });
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
    criteria.value = [emptyCriterion()];
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
      <button :class="{ active: section === 'activities' }" @click="section = 'activities'">Actividades</button>
      <button :class="{ active: section === 'rubrics' }" @click="section = 'rubrics'">Rúbricas</button>
    </nav>
    <p v-if="message" class="alert success">{{ message }}</p>
    <p v-if="error" class="alert error">{{ error }}</p>

    <template v-if="section === 'activities'">
      <form class="panel form-grid" @submit.prevent="createActivity">
        <div class="span-2"><h2>Nueva actividad</h2><p class="muted">Define la información básica que verá el estudiante.</p></div>
        <label>Título<input v-model="activityForm.title" required maxlength="160" /></label>
        <label>Asignatura<input v-model="activityForm.subject" required maxlength="120" /></label>
        <label>Fecha de entrega<input v-model="activityForm.dueDate" type="date" required /></label>
        <label>Tipo<input v-model="activityForm.activityType" placeholder="Ensayo, proyecto…" required maxlength="80" /></label>
        <button class="button primary span-2">Crear actividad</button>
      </form>

      <section class="section-block">
        <div class="section-title"><h2>Actividades configuradas</h2><span>{{ activities.length }}</span></div>
        <article v-for="activity in activities" :key="activity.id" class="panel activity-editor">
          <div class="card-topline">
            <div><span class="eyebrow">{{ activity.subject }} · {{ activity.activityType }}</span><h3>{{ activity.title }}</h3></div>
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
        <div><h2>Nueva rúbrica</h2><p class="muted">Agrega criterios, dimensiones y descriptores para los niveles 1–4.</p></div>
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
          <button v-if="criteria.length > 1" class="text-button danger" type="button" @click="criteria.splice(index, 1)">Eliminar criterio</button>
        </fieldset>
        <button class="button secondary" type="button" @click="criteria.push(emptyCriterion())">+ Agregar criterio</button>
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
