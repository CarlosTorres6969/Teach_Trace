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
import { computed, onMounted, ref, watch } from 'vue';
import { Line } from 'vue-chartjs';
import { api } from '../api';
import type { AcademicClass, PerformanceChart } from '../types';

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

// Clases disponibles para el selector (se pasan desde el dashboard)
const props = defineProps<{ classes: Pick<AcademicClass, 'id' | 'name' | 'code'>[] }>();

const selectedClassId = ref<number | 'all'>('all');
const chartData = ref<PerformanceChart | null>(null);
const loading = ref(true);
const error = ref('');

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const query =
      selectedClassId.value !== 'all' ? `?classId=${selectedClassId.value}` : '';
    chartData.value = await api<PerformanceChart>(`/student/performance-chart${query}`);
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'No se pudo cargar el gráfico';
  } finally {
    loading.value = false;
  }
}

watch(selectedClassId, load);
onMounted(load);

// ─── Datos del gráfico ────────────────────────────────────────────────────────
const lineChartData = computed(() => {
  if (!chartData.value) return null;
  const { labels, myGrades, classAverage, trendLine, activities } = chartData.value;

  // Etiquetas legibles: título de actividad (fallback: fecha)
  const readableLabels = labels.map(
    (l, i) => activities[i]?.title ?? l,
  );

  return {
    labels: readableLabels,
    datasets: [
      {
        label: 'Mi nota (%)',
        data: myGrades,
        borderColor: '#234f8f',
        backgroundColor: 'rgba(35,79,143,0.10)',
        pointBackgroundColor: '#234f8f',
        pointRadius: 5,
        pointHoverRadius: 7,
        tension: 0.35,
        fill: false,
        spanGaps: false,
        order: 1,
      },
      {
        label: 'Promedio clase (%)',
        data: classAverage,
        borderColor: 'rgba(100,120,150,0.55)',
        backgroundColor: 'rgba(100,120,150,0.08)',
        pointBackgroundColor: 'rgba(100,120,150,0.55)',
        pointRadius: 3,
        tension: 0.35,
        fill: true,
        spanGaps: true,
        order: 2,
      },
      {
        label: 'Tendencia',
        data: trendLine,
        borderColor: '#f5a623',
        backgroundColor: 'transparent',
        pointRadius: 0,
        tension: 0,
        borderDash: [6, 4],
        fill: false,
        spanGaps: true,
        order: 3,
      },
    ],
  };
});

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index' as const, intersect: false },
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: { boxWidth: 14, font: { size: 12 } },
    },
    tooltip: {
      callbacks: {
        title: (items: TooltipItem<'line'>[]) => {
          const idx = items[0]?.dataIndex ?? 0;
          const act = chartData.value?.activities[idx];
          return act ? `${act.title}` : items[0]?.label ?? '';
        },
        label: (item: TooltipItem<'line'>) => {
          const val = item.parsed.y;
          if (val === null || val === undefined) return `${item.dataset.label}: —`;
          return `${item.dataset.label}: ${val}%`;
        },
        afterLabel: (item: TooltipItem<'line'>) => {
          // Solo en el primer dataset (mi nota) mostramos la fecha
          if (item.datasetIndex !== 0) return '';
          const idx = item.dataIndex;
          const dueDate = chartData.value?.activities[idx]?.dueDate;
          return dueDate ? `Entrega: ${dueDate}` : '';
        },
      },
    },
  },
  scales: {
    y: {
      min: 0,
      max: 100,
      ticks: {
        callback: (v: number | string) => `${v}%`,
        stepSize: 25,
      },
      grid: { color: 'rgba(0,0,0,0.05)' },
    },
    x: {
      ticks: {
        maxRotation: 30,
        font: { size: 11 },
        callback: (_val: unknown, index: number) => {
          const label = lineChartData.value?.labels[index] ?? '';
          return label.length > 16 ? label.slice(0, 15) + '…' : label;
        },
      },
      grid: { display: false },
    },
  },
}));

const hasData = computed(
  () => chartData.value?.myGrades.some((g) => g !== null) ?? false,
);
</script>

<template>
  <section class="evolution-chart panel">
    <div class="evolution-header">
      <div>
        <span class="eyebrow">Evolución de calificaciones</span>
        <h2>Mi progreso por actividad</h2>
      </div>

      <!-- Selector de clase -->
      <div v-if="props.classes.length > 1" class="evolution-selector">
        <label>
          Clase
          <select v-model="selectedClassId">
            <option value="all">Todas las clases</option>
            <option
              v-for="c in props.classes"
              :key="c.id"
              :value="c.id"
            >
              {{ c.code }} — {{ c.name }}
            </option>
          </select>
        </label>
      </div>
    </div>

    <p v-if="loading" class="muted evolution-loading">Cargando gráfico…</p>
    <p v-else-if="error" class="alert error">{{ error }}</p>
    <div v-else-if="hasData && lineChartData" class="evolution-chart-area">
      <Line :data="lineChartData" :options="chartOptions" />
    </div>
    <div v-else class="panel empty-state evolution-empty">
      <h3>Sin calificaciones todavía</h3>
      <p>El gráfico aparecerá cuando el docente califique al menos una actividad.</p>
    </div>
  </section>
</template>
