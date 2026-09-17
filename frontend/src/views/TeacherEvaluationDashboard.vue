<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { api } from '../api';
import type { AcademicClass, Activity } from '../types';

type EvaluationRow = {
  id: number;
  status: string;
  evaluationStatus: string;
  manualReviewRequired: boolean;
  submittedAt: string | null;
  student: { id: number; name: string; email: string };
  activity: { id: number; title: string; dueDate: string };
  academicClass: { id: number; name: string; code: string };
};

const classes = ref<AcademicClass[]>([]);
const activities = ref<Activity[]>([]);
const rows = ref<EvaluationRow[]>([]);
const loading = ref(true);
const error = ref('');
const filters = reactive({ classId: '', activityId: '', studentId: '', status: '' });

const students = computed(() => {
  const seen = new Map<number, { id: number; name: string; email: string }>();
  for (const row of rows.value) seen.set(row.student.id, row.student);
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
});

const filteredActivities = computed(() =>
  filters.classId
    ? activities.value.filter((activity) => activity.academicClass?.id === Number(filters.classId))
    : activities.value,
);

const statusLabel: Record<string, string> = {
  submitted: 'Entregada',
  under_review: 'En revisión',
  evaluated: 'Evaluada',
};

async function loadCatalog() {
  [classes.value, activities.value] = await Promise.all([
    api<AcademicClass[]>('/teacher/classes'),
    api<Activity[]>('/teacher/activities'),
  ]);
}

async function loadRows() {
  loading.value = true;
  error.value = '';
  try {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
    rows.value = await api<EvaluationRow[]>(`/teacher/submissions?${params.toString()}`);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudieron cargar las entregas';
  } finally {
    loading.value = false;
  }
}

function clearFilters() {
  Object.assign(filters, { classId: '', activityId: '', studentId: '', status: '' });
}

watch(() => filters.classId, () => {
  if (filters.activityId && !filteredActivities.value.some((activity) => activity.id === Number(filters.activityId))) {
    filters.activityId = '';
  }
  void loadRows();
});
watch(() => [filters.activityId, filters.studentId, filters.status], () => void loadRows());

onMounted(async () => {
  try {
    await loadCatalog();
    await loadRows();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo cargar el panel';
    loading.value = false;
  }
});
</script>

<template>
  <main class="page narrow">
    <section class="page-heading compact">
      <div>
        <span class="eyebrow">Seguimiento docente</span>
        <h1>Entregas por evaluar</h1>
      </div>
      <RouterLink class="button secondary" to="/teacher">Panel docente</RouterLink>
    </section>

    <section class="panel form-grid evaluation-filters">
      <label>Clase
        <select v-model="filters.classId">
          <option value="">Todas</option>
          <option v-for="item in classes" :key="item.id" :value="item.id">{{ item.code }} · {{ item.name }}</option>
        </select>
      </label>
      <label>Actividad
        <select v-model="filters.activityId">
          <option value="">Todas</option>
          <option v-for="item in filteredActivities" :key="item.id" :value="item.id">{{ item.title }}</option>
        </select>
      </label>
      <label>Estudiante
        <select v-model="filters.studentId">
          <option value="">Todos</option>
          <option v-for="student in students" :key="student.id" :value="student.id">{{ student.name }}</option>
        </select>
      </label>
      <label>Estado
        <select v-model="filters.status">
          <option value="">Todos</option>
          <option value="submitted">Entregada</option>
          <option value="under_review">En revisión</option>
          <option value="evaluated">Evaluada</option>
        </select>
      </label>
      <button class="button secondary" type="button" @click="clearFilters">Limpiar filtros</button>
    </section>

    <p v-if="error" class="alert error">{{ error }}</p>
    <p v-if="loading" class="muted">Cargando entregas…</p>
    <section v-else class="panel evaluation-table-wrap">
      <table class="evaluation-table">
        <thead><tr><th>Estudiante</th><th>Clase</th><th>Actividad</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td><strong>{{ row.student.name }}</strong><small>{{ row.student.email }}</small></td>
            <td>{{ row.academicClass.code }}</td>
            <td>{{ row.activity.title }}</td>
            <td><span class="status" :data-status="row.status">{{ statusLabel[row.status] ?? row.status }}</span></td>
            <td><RouterLink class="button secondary" :to="`/teacher/activities/${row.activity.id}/submissions`">Abrir</RouterLink></td>
          </tr>
          <tr v-if="!rows.length"><td colspan="5" class="empty-state">No hay entregas con estos filtros.</td></tr>
        </tbody>
      </table>
    </section>
  </main>
</template>
