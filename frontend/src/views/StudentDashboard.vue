<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '../api';
import { auth } from '../auth';
import EvolutionChart from '../components/EvolutionChart.vue';
import ProjectionWidget from '../components/ProjectionWidget.vue';
import type { Activity } from '../types';

type ActivityWithScore = Activity & {
  dueDate: string;
  weight: number;
  finalScore: number | null;
};

const activities = ref<ActivityWithScore[]>([]);
const error = ref('');
const loading = ref(true);

const statusText: Record<string, string> = {
  not_submitted: 'Sin entregar',
  submitted: 'Entregado',
  under_review: 'En revisión',
  evaluated: 'Evaluado',
};

// Clases únicas del estudiante (para widgets y selector de gráfico)
const uniqueClasses = computed(() => {
  const seen = new Map<number, { id: number; name: string; code: string }>();
  for (const a of activities.value) {
    const c = a.academicClass;
    if (c && !seen.has(c.id)) seen.set(c.id, c);
  }
  return [...seen.values()];
});

const uniqueClassIds = computed(() => uniqueClasses.value.map((c) => c.id));

onMounted(async () => {
  try {
    activities.value = await api<ActivityWithScore[]>('/student/activities');
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudieron cargar las actividades';
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <main class="page">
    <section class="page-heading">
      <div>
        <span class="eyebrow">Panel del estudiante</span>
        <h1>Hola, {{ auth.user?.name }}</h1>
      </div>
      <p>Continúa documentando el proceso de tus actividades.</p>
    </section>

    <p v-if="loading" class="muted">Cargando actividades…</p>
    <p v-else-if="error" class="alert error">{{ error }}</p>

    <template v-else>
      <!-- Widget de proyección — uno por clase -->
      <ProjectionWidget
        v-for="classId in uniqueClassIds"
        :key="classId"
        :class-id="classId"
      />

      <!-- Gráfico de evolución -->
      <EvolutionChart v-if="uniqueClasses.length > 0" :classes="uniqueClasses" />

      <!-- Lista de actividades -->
      <section class="card-grid">
        <article v-for="activity in activities" :key="activity.id" class="activity-card">
          <div class="card-topline">
            <span>{{ activity.academicClass?.code ?? activity.subject }}</span>
            <span class="status" :data-status="activity.submissionStatus">
              {{ statusText[activity.submissionStatus ?? 'not_submitted'] }}
            </span>
          </div>
          <h2>{{ activity.title }}</h2>

          <!-- Nota final si ya fue calificado -->
          <div v-if="activity.finalScore !== null" class="activity-score">
            <span class="eyebrow">Nota promedio</span>
            <strong>{{ ((activity.finalScore - 1) / 3 * 100).toFixed(0) }}%</strong>
            <span class="muted">/ 100%</span>
          </div>
          <p v-else>Registra tu bitácora, declara el uso de IA y consulta tu entrega.</p>

          <div class="activity-card-actions">
            <RouterLink class="button primary" :to="`/student/activities/${activity.id}`">
              Abrir actividad
            </RouterLink>
            <RouterLink
              v-if="activity.submissionStatus === 'evaluated'"
              class="button secondary"
              :to="`/student/activities/${activity.id}/results`"
            >
              Ver resultados
            </RouterLink>
          </div>
        </article>
        <div v-if="!activities.length" class="empty-state">
          No hay actividades disponibles.
        </div>
      </section>
    </template>
  </main>
</template>
