<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api } from '../api';
import { auth } from '../auth';
import type { Activity } from '../types';

const activities = ref<Activity[]>([]);
const error = ref('');
const loading = ref(true);

const statusText: Record<string, string> = {
  not_submitted: 'Sin entregar',
  submitted: 'Entregado',
  under_review: 'En revisión',
  evaluated: 'Evaluado',
};

onMounted(async () => {
  try {
    activities.value = await api<Activity[]>('/student/activities');
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
      <div><span class="eyebrow">Panel del estudiante</span><h1>Hola, {{ auth.user?.name }}</h1></div>
      <p>Continúa documentando el proceso de tus actividades.</p>
    </section>
    <p v-if="loading" class="muted">Cargando actividades…</p>
    <p v-else-if="error" class="alert error">{{ error }}</p>
    <section v-else class="card-grid">
      <article v-for="activity in activities" :key="activity.id" class="activity-card">
        <div class="card-topline"><span>{{ activity.academicClass?.code ?? activity.subject }}</span><span class="status" :data-status="activity.submissionStatus">{{ statusText[activity.submissionStatus ?? 'not_submitted'] }}</span></div>
        <h2>{{ activity.title }}</h2>
        <p>Registra tu bitácora, declara el uso de IA y consulta tu entrega.</p>
        <RouterLink class="button primary" :to="`/student/activities/${activity.id}`">Abrir actividad</RouterLink>
      </article>
      <div v-if="!activities.length" class="empty-state">No hay actividades disponibles.</div>
    </section>
  </main>
</template>
