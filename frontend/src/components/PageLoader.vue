<script setup lang="ts">
import { LoaderCircleIcon } from '@lucide/vue';

withDefaults(defineProps<{
  label?: string;
  detail?: string;
  compact?: boolean;
}>(), {
  label: 'Cargando información…',
  detail: '',
  compact: false,
});
</script>

<template>
  <div
    class="page-loader panel"
    :class="{ 'page-loader--compact': compact }"
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    <LoaderCircleIcon class="page-loader-icon icon-spin" aria-hidden="true" />
    <div>
      <strong>{{ label }}</strong>
      <p v-if="detail">{{ detail }}</p>
    </div>
  </div>
</template>
