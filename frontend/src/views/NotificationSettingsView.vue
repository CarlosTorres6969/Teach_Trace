<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { api } from '../api';
import type {
  NotificationChannel,
  NotificationEventType,
  NotificationPreference,
} from '../types';

const eventDefinitions: Array<{
  type: NotificationEventType;
  label: string;
  description: string;
}> = [
  {
    type: 'NEW_ACTIVITY',
    label: 'Nueva actividad',
    description: 'Cuando un docente publique una actividad en una de tus clases.',
  },
  {
    type: 'GRADE_PUBLISHED',
    label: 'Calificación publicada',
    description: 'Cuando esté disponible el resultado de una evaluación.',
  },
  {
    type: 'ACTIVITY_DUE_SOON',
    label: 'Actividad próxima a vencer',
    description: 'Cuando se acerque la fecha límite de una actividad pendiente.',
  },
  {
    type: 'SUBMISSION_STATUS_CHANGED',
    label: 'Estado de entrega actualizado',
    description: 'Cuando cambie el estado de revisión de uno de tus productos.',
  },
];

const channels: Array<{ type: NotificationChannel; label: string }> = [
  { type: 'EMAIL', label: 'Email' },
  { type: 'PUSH', label: 'Push' },
  { type: 'IN_APP', label: 'En plataforma' },
];

const preferences = ref<NotificationPreference[]>([]);
const loading = ref(true);
const saving = ref(false);
const error = ref('');
const toast = ref('');
let toastTimer: ReturnType<typeof setTimeout> | undefined;

function isEnabled(eventType: NotificationEventType, channel: NotificationChannel) {
  return preferences.value
    .find((preference) => preference.eventType === eventType)
    ?.channels.includes(channel) ?? false;
}

function updateChannel(eventType: NotificationEventType, channel: NotificationChannel, event: Event) {
  if (channel === 'IN_APP') return;
  const preference = preferences.value.find((item) => item.eventType === eventType);
  if (!preference) return;

  const enabled = (event.target as HTMLInputElement).checked;
  preference.channels = enabled
    ? [...new Set([...preference.channels, channel])]
    : preference.channels.filter((storedChannel) => storedChannel !== channel);
}

async function loadPreferences() {
  loading.value = true;
  error.value = '';
  try {
    preferences.value = await api<NotificationPreference[]>('/notification-preferences');
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudieron cargar las preferencias';
  } finally {
    loading.value = false;
  }
}

async function savePreferences() {
  if (preferences.value.some((preference) => !preference.channels.includes('IN_APP'))) {
    error.value = 'Las notificaciones en plataforma deben permanecer activas.';
    return;
  }

  saving.value = true;
  error.value = '';
  toast.value = '';
  try {
    preferences.value = await api<NotificationPreference[]>('/notification-preferences', {
      method: 'PUT',
      body: JSON.stringify({ preferences: preferences.value }),
    });
    toast.value = 'Preferencias guardadas correctamente.';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.value = '';
    }, 3500);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No fue posible guardar las preferencias';
  } finally {
    saving.value = false;
  }
}

onMounted(loadPreferences);
onBeforeUnmount(() => {
  if (toastTimer) clearTimeout(toastTimer);
});
</script>

<template>
  <main class="page narrow notification-settings">
    <RouterLink class="back-link" to="/student">← Volver al panel</RouterLink>
    <section class="page-heading compact">
      <div>
        <span class="eyebrow">Configuración personal</span>
        <h1>Notificaciones</h1>
      </div>
      <p>Elige por qué medios quieres recibir cada tipo de aviso.</p>
    </section>

    <p v-if="loading" class="muted">Cargando preferencias…</p>
    <p v-else-if="error && !preferences.length" class="alert error">{{ error }}</p>

    <form v-else class="panel notification-form" @submit.prevent="savePreferences">
      <div class="notification-table-wrap">
        <table class="notification-table">
          <thead>
            <tr>
              <th scope="col">Evento</th>
              <th v-for="channel in channels" :key="channel.type" scope="col">
                {{ channel.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="eventDefinition in eventDefinitions" :key="eventDefinition.type">
              <th scope="row">
                <strong>{{ eventDefinition.label }}</strong>
                <small>{{ eventDefinition.description }}</small>
              </th>
              <td v-for="channel in channels" :key="channel.type">
                <label class="notification-checkbox">
                  <input
                    type="checkbox"
                    :aria-label="`${eventDefinition.label}: ${channel.label}`"
                    :checked="isEnabled(eventDefinition.type, channel.type)"
                    :disabled="channel.type === 'IN_APP'"
                    @change="updateChannel(eventDefinition.type, channel.type, $event)"
                  />
                  <span aria-hidden="true"></span>
                </label>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="platform-notice">
        “En plataforma” permanece activo para que no pierdas avisos académicos importantes.
      </p>
      <p v-if="error" class="alert error">{{ error }}</p>
      <div class="notification-actions">
        <button class="button primary" type="submit" :disabled="saving">
          {{ saving ? 'Guardando…' : 'Guardar preferencias' }}
        </button>
      </div>
    </form>

    <div v-if="toast" class="toast" role="status" aria-live="polite">{{ toast }}</div>
  </main>
</template>
