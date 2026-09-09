<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../api';

type ValuationItem = {
  id: number;
  criterion: string;
  dimension: string;
  aiValue: number | null;
  teacherValue: number | null;
  teacherComment: string;
  confirmed: boolean;
};

type ResultsResponse = {
  activity: { id: number; title: string };
  student: { id: number; name: string };
  status: string;
  valuations: ValuationItem[];
  finalScore: number | null;
  feedback: string;
  submissionId?: number | null;
  teacherId?: number | null;
};

const route = useRoute();
const activityId = Number(route.params.id);

const results = ref<ResultsResponse | null>(null);
const loading = ref(true);
const error = ref('');

// URL para "Consultar al docente" — pre-llena la conversación con submissionId
const consultUrl = computed(() => {
  if (!results.value) return '/student/messages';
  const params = new URLSearchParams();
  if (results.value.submissionId) params.set('submissionId', String(results.value.submissionId));
  if (results.value.teacherId) params.set('teacherId', String(results.value.teacherId));
  const qs = params.toString();
  return `/student/messages${qs ? `?${qs}` : ''}`;
});

async function load() {
  try {
    results.value = await api<ResultsResponse>(
      `/student/activities/${activityId}/results`,
    );
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'No se pudieron cargar los resultados';
  } finally {
    loading.value = false;
  }
}

function levelLabel(level: number | null): string {
  if (level === null) return '—';
  const labels: Record<number, string> = {
    1: 'Nivel 1 — Insuficiente',
    2: 'Nivel 2 — En desarrollo',
    3: 'Nivel 3 — Satisfactorio',
    4: 'Nivel 4 — Excelente',
  };
  return labels[level] ?? String(level);
}

onMounted(load);
</script>

<template>
  <main class="page narrow">
    <section class="page-heading compact">
      <div>
        <span class="eyebrow">Mis resultados</span>
        <h1>{{ results?.activity.title ?? 'Cargando…' }}</h1>
      </div>
      <div class="page-heading-actions">
        <RouterLink class="button secondary back-link" :to="`/student/activities/${activityId}`">
          ← Volver
        </RouterLink>
        <RouterLink
          v-if="results?.status === 'evaluated'"
          class="button primary"
          :to="consultUrl"
        >
          💬 Consultar al docente
        </RouterLink>
      </div>
    </section>

    <p v-if="loading" class="muted">Cargando resultados…</p>
    <p v-else-if="error" class="alert error">{{ error }}</p>

    <template v-else-if="results">
      <!-- Resumen de estado -->
      <div class="panel results-summary">
        <div class="results-status-row">
          <div>
            <span class="eyebrow">Estado de la evaluación</span>
            <p class="results-status-label">
              {{
                results.status === 'evaluated'
                  ? 'Evaluación completada'
                  : results.status === 'under_review'
                  ? 'En revisión por el docente'
                  : 'Pendiente de evaluación'
              }}
            </p>
          </div>
          <span
            class="status"
            :data-status="results.status"
          >
            {{
              results.status === 'evaluated'
                ? 'Calificado'
                : results.status === 'under_review'
                ? 'En revisión'
                : 'Pendiente'
            }}
          </span>
        </div>

        <div v-if="results.finalScore !== null" class="results-score">
          <span class="eyebrow">Promedio de niveles</span>
          <strong class="results-score-value">{{ results.finalScore.toFixed(2) }}</strong>
          <span class="muted">/ 4.00</span>
        </div>

        <div v-if="results.feedback" class="results-feedback">
          <span class="eyebrow">Retroalimentación general</span>
          <p>{{ results.feedback }}</p>
        </div>
      </div>

      <!-- Sin valoraciones todavía -->
      <div v-if="!results.valuations.length" class="panel empty-state">
        <h3>Aún no hay valoraciones</h3>
        <p>El docente revisará criterio por criterio y publicará los resultados cuando termine.</p>
      </div>

      <!-- Tabla de valoraciones por criterio -->
      <section v-else class="section-block">
        <div class="section-title">
          <h2>Valoración por criterio</h2>
          <span>{{ results.valuations.length }}</span>
        </div>

        <article
          v-for="val in results.valuations"
          :key="val.id"
          class="panel valuation-card"
          :class="{ 'valuation-card--confirmed': val.confirmed }"
        >
          <div class="valuation-header">
            <div>
              <span class="eyebrow">{{ val.dimension }}</span>
              <h3>{{ val.criterion }}</h3>
            </div>
            <span v-if="val.confirmed" class="status" data-status="evaluated">Confirmado</span>
            <span v-else class="status">Pendiente</span>
          </div>

          <div class="valuation-levels">
            <div class="valuation-level-item">
              <span class="muted">Valoración IA</span>
              <strong :class="{ 'level-value': true, 'level-pending': val.aiValue === null }">
                {{ levelLabel(val.aiValue) }}
              </strong>
            </div>
            <div class="valuation-level-item valuation-level-teacher">
              <span class="muted">Valoración docente</span>
              <strong :class="{ 'level-value': true, 'level-pending': val.teacherValue === null }">
                {{ levelLabel(val.teacherValue) }}
              </strong>
            </div>
          </div>

          <div v-if="val.teacherComment" class="valuation-comment">
            <span class="eyebrow">Comentario del docente</span>
            <p>{{ val.teacherComment }}</p>
          </div>
        </article>
      </section>
    </template>
  </main>
</template>
