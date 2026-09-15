<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '../api';
import { auth } from '../auth';
import ProjectionWidget from '../components/ProjectionWidget.vue';
import type { Activity } from '../types';

type DashboardFilter = 'week' | 'month' | 'all';
type ActivityWithProgress = Activity & {
  dueDate: string;
  weight: number;
  finalScore: number | null;
  submissionStatus: string;
  completionPercentage: number;
  missingSections: string[];
  logbookStatus: 'not_started' | 'in_progress' | 'complete';
};

const activities = ref<ActivityWithProgress[]>([]);
const error = ref('');
const loading = ref(true);
const selectedFilter = ref<DashboardFilter>('week');
const showCompleted = ref(false);

const filters: Array<{ value: DashboardFilter; label: string }> = [
  { value: 'week', label: 'Esta semana' },
  { value: 'month', label: 'Este mes' },
  { value: 'all', label: 'Todas' },
];

const statusText: Record<string, string> = {
  not_submitted: 'Sin entregar',
  submitted: 'Entregado',
  under_review: 'En revisión',
  evaluated: 'Evaluado',
};

const logbookText = {
  not_started: 'Sin iniciar',
  in_progress: 'En progreso',
  complete: 'Completa',
};

const pendingActivities = computed(() =>
  activities.value.filter((activity) => activity.submissionStatus === 'not_submitted'),
);
const completedActivities = computed(() =>
  activities.value.filter((activity) => activity.submissionStatus !== 'not_submitted'),
);
const counterLabel = computed(() => {
  const count = pendingActivities.value.length;
  const period = selectedFilter.value === 'week'
    ? 'esta semana'
    : selectedFilter.value === 'month' ? 'este mes' : 'en total';
  return `${count} ${count === 1 ? 'entrega pendiente' : 'entregas pendientes'} ${period}`;
});

const uniqueClasses = computed(() => {
  const seen = new Map<number, { id: number; name: string; code: string }>();
  for (const activity of activities.value) {
    const academicClass = activity.academicClass;
    if (academicClass && !seen.has(academicClass.id)) seen.set(academicClass.id, academicClass);
  }
  return [...seen.values()];
});

async function loadActivities(filter = selectedFilter.value) {
  loading.value = true;
  error.value = '';
  try {
    activities.value = await api<ActivityWithProgress[]>(`/student/activities?filter=${filter}`);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudieron cargar las actividades';
  } finally {
    loading.value = false;
  }
}

function chooseFilter(filter: DashboardFilter) {
  if (selectedFilter.value === filter) return;
  selectedFilter.value = filter;
  showCompleted.value = false;
  void loadActivities(filter);
}

function dueTime(activity: ActivityWithProgress) {
  return new Date(`${activity.dueDate}T23:59:59`).getTime();
}

function remainingHours(activity: ActivityWithProgress) {
  return (dueTime(activity) - Date.now()) / (60 * 60 * 1000);
}

function isUrgent(activity: ActivityWithProgress) {
  const hours = remainingHours(activity);
  return activity.submissionStatus === 'not_submitted' && hours >= 0 && hours < 48;
}

function remainingLabel(activity: ActivityWithProgress) {
  const hours = remainingHours(activity);
  if (hours < 0) return 'Fecha vencida';
  if (hours < 24) return 'Vence hoy';
  if (hours < 48) return 'Vence mañana';
  return `Faltan ${Math.ceil(hours / 24)} días`;
}

function formatDueDate(value: string) {
  return new Intl.DateTimeFormat('es-HN', {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(new Date(`${value}T12:00:00`));
}

function progressLevel(percentage: number) {
  if (percentage < 40) return 'low';
  if (percentage <= 70) return 'medium';
  return 'high';
}

function progressTooltip(activity: ActivityWithProgress) {
  return activity.missingSections.length
    ? `Faltan: ${activity.missingSections.join(', ')}`
    : 'Todas las secciones están completas';
}

onMounted(() => loadActivities());
</script>

<template>
  <main class="page">
    <section class="page-heading">
      <div>
        <span class="eyebrow">Panel del estudiante</span>
        <h1>Hola, {{ auth.user?.name }}</h1>
      </div>
      <p>Prioriza tus próximas entregas y continúa documentando tu proceso.</p>
    </section>

    <section class="dashboard-toolbar panel" aria-label="Filtros de actividades">
      <div>
        <span class="eyebrow">Próximas entregas</span>
        <strong class="dashboard-counter" aria-live="polite">{{ counterLabel }}</strong>
      </div>
      <div class="activity-filters" role="group" aria-label="Filtrar por fecha límite">
        <button
          v-for="filter in filters"
          :key="filter.value"
          class="filter-button"
          :class="{ active: selectedFilter === filter.value }"
          type="button"
          :aria-pressed="selectedFilter === filter.value"
          @click="chooseFilter(filter.value)"
        >{{ filter.label }}</button>
      </div>
    </section>

    <p v-if="loading" class="muted">Cargando actividades…</p>
    <p v-else-if="error" class="alert error">{{ error }}</p>

    <template v-else>
      <!-- Widget de proyección — uno por clase -->
      <ProjectionWidget
        v-for="academicClass in uniqueClasses"
        :key="academicClass.id"
        :class-id="academicClass.id"
        :class-name="academicClass.name"
        :class-code="academicClass.code"
      />

      <!-- Entregas pendientes -->
      <section class="card-grid activity-dashboard-grid" aria-label="Entregas pendientes">
        <article
          v-for="activity in pendingActivities"
          :key="activity.id"
          class="activity-card"
          :class="{ 'activity-card--urgent': isUrgent(activity) }"
        >
          <div class="card-topline">
            <span>{{ activity.academicClass?.name ?? activity.subject }}</span>
            <span v-if="activity.isNew" class="new-activity-badge">Nuevo</span>
            <span v-if="isUrgent(activity)" class="urgent-badge">Menos de 48 h</span>
          </div>
          <h2>{{ activity.title }}</h2>
          <div class="activity-meta">
            <span><strong>Fecha límite:</strong> {{ formatDueDate(activity.dueDate) }}</span>
            <span :class="{ 'urgent-text': isUrgent(activity) }">{{ remainingLabel(activity) }}</span>
            <span><strong>Bitácora:</strong> {{ logbookText[activity.logbookStatus] }}</span>
          </div>

          <div
            class="activity-progress"
            :class="`activity-progress--${progressLevel(activity.completionPercentage)}`"
            :title="progressTooltip(activity)"
          >
            <div class="activity-progress-heading">
              <span>Progreso</span><strong>{{ activity.completionPercentage }}%</strong>
            </div>
            <div
              class="activity-progress-track"
              role="progressbar"
              aria-label="Progreso de la actividad"
              aria-valuemin="0"
              aria-valuemax="100"
              :aria-valuenow="activity.completionPercentage"
            ><span :style="{ width: `${activity.completionPercentage}%` }"></span></div>
            <small>{{ progressTooltip(activity) }}</small>
          </div>

          <div class="activity-card-actions">
            <RouterLink class="button primary" :to="`/student/activities/${activity.id}`">
              Abrir actividad
            </RouterLink>
            <RouterLink
              v-if="activity.academicClass"
              class="button secondary"
              :to="`/student/classes/${activity.academicClass.id}/forum`"
            >Foro de la clase</RouterLink>
          </div>
        </article>
        <div v-if="!pendingActivities.length" class="panel empty-state">
          <h3>No hay entregas pendientes en este período</h3>
          <p>Prueba otro filtro o consulta las actividades completadas.</p>
        </div>
      </section>

      <section v-if="completedActivities.length" class="completed-activities-section">
        <button
          class="completed-toggle"
          type="button"
          :aria-expanded="showCompleted"
          @click="showCompleted = !showCompleted"
        >
          <span>{{ showCompleted ? 'Ocultar completadas' : 'Ver completadas' }}</span>
          <span class="section-count">{{ completedActivities.length }}</span>
        </button>
        <div v-if="showCompleted" class="card-grid activity-dashboard-grid">
          <article v-for="activity in completedActivities" :key="activity.id" class="activity-card">
            <div class="card-topline">
              <span>{{ activity.academicClass?.name ?? activity.subject }}</span>
              <span class="status" :data-status="activity.submissionStatus">
                {{ statusText[activity.submissionStatus] }}
              </span>
            </div>
            <h2>{{ activity.title }}</h2>
            <p><strong>Fecha límite:</strong> {{ formatDueDate(activity.dueDate) }}</p>
            <div
              class="activity-progress"
              :class="`activity-progress--${progressLevel(activity.completionPercentage)}`"
              :title="progressTooltip(activity)"
            >
              <div class="activity-progress-heading">
                <span>Progreso</span><strong>{{ activity.completionPercentage }}%</strong>
              </div>
              <div class="activity-progress-track">
                <span :style="{ width: `${activity.completionPercentage}%` }"></span>
              </div>
            </div>
            <div class="activity-card-actions">
              <RouterLink class="button secondary" :to="`/student/activities/${activity.id}`">
                Abrir actividad
              </RouterLink>
              <RouterLink
                v-if="activity.submissionStatus === 'evaluated'"
                class="button primary"
                :to="`/student/activities/${activity.id}/results`"
              >Ver resultados</RouterLink>
            </div>
          </article>
        </div>
      </section>
    </template>
  </main>
</template>
