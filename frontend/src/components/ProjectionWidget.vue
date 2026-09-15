<script setup lang="ts">
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
  type TooltipItem,
} from 'chart.js';
import { computed, onMounted, ref } from 'vue';
import { Line } from 'vue-chartjs';
import { accessibilitySettings } from '../accessibility';
import { api } from '../api';
import { chartThemePalette } from '../chart-theme';
import { resolvedTheme } from '../theme';
import type { ProjectionData } from '../types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

const props = defineProps<{
  classId: number;
  className?: string;
  classCode?: string;
}>();

const projection = ref<ProjectionData | null>(null);
const loading = ref(true);
const error = ref('');

async function load() {
  try {
    projection.value = await api<ProjectionData>(
      `/student/classes/${props.classId}/projection`,
    );
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'No se pudo cargar la proyección';
  } finally {
    loading.value = false;
  }
}

// ─── Datos del gráfico ────────────────────────────────────────────────────────
const chartData = computed(() => {
  if (!projection.value) return null;
  const palette = chartThemePalette(
    resolvedTheme.value,
    accessibilitySettings.value.highContrast,
  );

  const acts = projection.value.activities;
  const labels = acts.map((a, i) => `Act. ${i + 1}`);

  // Puntos reales (completadas)
  const realPoints = acts.map((a) => (a.percentage !== null ? a.percentage : null));

  // Línea de proyección punteada — para las pendientes, usar projectedPercentage plano
  const projectedPct = projection.value.projectedPercentage;
  const projectionPoints = acts.map((a) =>
    a.percentage !== null ? a.percentage : projectedPct,
  );

  return {
    labels,
    datasets: [
      {
        label: 'Nota real (%)',
        data: realPoints,
        borderColor: palette.primary,
        backgroundColor: palette.primaryFill,
        pointBackgroundColor: palette.primary,
        pointRadius: 5,
        tension: 0.3,
        fill: false,
        spanGaps: false,
      },
      {
        label: 'Proyección (%)',
        data: projectionPoints,
        borderColor: palette.accent,
        backgroundColor: palette.accentFill,
        pointBackgroundColor: palette.accent,
        pointRadius: 4,
        tension: 0.3,
        borderDash: [6, 4],
        fill: false,
        spanGaps: true,
      },
    ],
  };
});

const chartOptions = computed(() => {
  const fontScale = accessibilitySettings.value.fontSize / 100;
  const palette = chartThemePalette(
    resolvedTheme.value,
    accessibilitySettings.value.highContrast,
  );

  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          boxWidth: 14,
          color: palette.text,
          font: { size: Math.round(12 * fontScale) },
        },
      },
      tooltip: {
        titleFont: { size: Math.round(12 * fontScale) },
        bodyFont: { size: Math.round(12 * fontScale) },
        callbacks: {
          label: (ctx: TooltipItem<'line'>) =>
            ctx.parsed.y !== null
              ? `${ctx.dataset.label ?? ''}: ${ctx.parsed.y}%`
              : 'Sin datos',
        },
      },
    },
    scales: {
      y: {
        min: 0,
        max: 100,
        ticks: {
          color: palette.text,
          font: { size: Math.round(12 * fontScale) },
          callback: (v: number | string) => `${v}%`,
          stepSize: 25,
        },
        grid: { color: palette.grid },
      },
      x: {
        ticks: {
          color: palette.text,
          font: { size: Math.round(11 * fontScale) },
        },
        grid: { display: false },
      },
    },
  };
});

// ─── Mensajes contextuales ────────────────────────────────────────────────────
const projectedLabel = computed(() => {
  const p = projection.value;
  if (!p || p.projectedPercentage === null) return null;
  return `Proyección de nota: ${p.projectedPercentage}%`;
});

const contextMessage = computed(() => {
  const p = projection.value;
  if (!p) return null;

  if (p.pendingActivities === 0) {
    if (p.projectedPercentage === null) return 'Aún no tienes calificaciones registradas.';
    return p.projectedPercentage >= 80
      ? `¡Bien hecho! Finalizaste con ${p.projectedPercentage}% — aprobado.`
      : `Finalizaste con ${p.projectedPercentage}%. No alcanzaste el 80% para aprobar.`;
  }

  if (p.requiredAvgToPass === null || p.projectedPercentage === null) {
    return `Tienes ${p.pendingActivities} entrega(s) pendiente(s).`;
  }

  // Convertir requiredAvgToPass (escala 1-4) a porcentaje
  const reqPct = Math.round(((p.requiredAvgToPass - 1) / 3) * 100);

  if (p.projectedPercentage >= 80) {
    return `Vas bien. Si mantienes tu rendimiento, aprobarás con ${p.projectedPercentage}%. Te quedan ${p.pendingActivities} entrega(s).`;
  }

  return `Necesitas un promedio de ${reqPct}% en las ${p.pendingActivities} entrega(s) restantes para aprobar con 80%.`;
});

const contextClass = computed(() => {
  const p = projection.value;
  if (!p || p.projectedPercentage === null) return 'projection-message--neutral';
  if (p.projectedPercentage >= 80) return 'projection-message--ok';
  if (p.projectedPercentage >= 60) return 'projection-message--warn';
  return 'projection-message--danger';
});

onMounted(load);
</script>

<template>
  <section v-if="!loading && !error && projection" class="projection-widget panel">
    <!-- Encabezado con el número clave -->
    <div class="projection-header">
      <div>
        <span class="eyebrow">
          {{ props.classCode && props.className
            ? `${props.classCode} · ${props.className}`
            : 'Rendimiento académico' }}
        </span>
        <h2 class="projection-title">
          {{ projectedLabel ?? 'Proyección de nota' }}
        </h2>
      </div>
      <div class="projection-stats">
        <div class="projection-stat">
          <strong>{{ projection.completedActivities }}</strong>
          <span>Calificadas</span>
        </div>
        <div class="projection-stat">
          <strong>{{ projection.pendingActivities }}</strong>
          <span>Pendientes</span>
        </div>
        <div class="projection-stat">
          <strong>{{ projection.totalActivities }}</strong>
          <span>Total</span>
        </div>
      </div>
    </div>

    <!-- Mensaje contextual -->
    <p v-if="contextMessage" class="projection-message" :class="contextClass">
      {{ contextMessage }}
    </p>

    <!-- Gráfico de línea -->
    <div v-if="chartData && projection.totalActivities > 0" class="projection-chart">
      <Line :data="chartData" :options="chartOptions" />
    </div>

    <!-- Sin datos suficientes -->
    <p v-else class="muted projection-empty">
      El gráfico estará disponible cuando haya al menos una actividad calificada.
    </p>
  </section>

  <p v-else-if="error" class="alert error">{{ error }}</p>
</template>
