<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '../api';
import { auth } from '../auth';
import EvolutionChart from '../components/EvolutionChart.vue';
import type { Activity } from '../types';

type ActivityItem = Activity & { dueDate: string };

const activities = ref<ActivityItem[]>([]);
const loading = ref(true);
const error = ref('');

const uniqueClasses = computed(() => {
  const seen = new Map<number, { id: number; name: string; code: string }>();
  for (const a of activities.value) {
    const c = a.academicClass;
    if (c && !seen.has(c.id)) seen.set(c.id, c);
  }
  return [...seen.values()];
});

onMounted(async () => {
  try {
    activities.value = await api<ActivityItem[]>('/student/activities');
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudieron cargar las actividades';
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <main class="page narrow">
    <section class="page-heading compact">
      <div>
        <span class="eyebrow">Perfil académico</span>
        <h1>{{ auth.user?.name }}</h1>
      </div>
      <RouterLink class="button secondary" to="/student">← Panel</RouterLink>
    </section>

    <p v-if="loading" class="muted">Cargando…</p>
    <p v-else-if="error" class="alert error">{{ error }}</p>

    <template v-else>
      <EvolutionChart v-if="uniqueClasses.length > 0" :classes="uniqueClasses" />
      <div v-else class="panel empty-state">
        <h3>Sin actividades todavía</h3>
        <p>El gráfico estará disponible cuando estés matriculado en al menos una clase con actividades.</p>
      </div>
    </template>
  </main>
</template>
