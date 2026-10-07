<script setup lang="ts">
import {
  LoaderCircleIcon,
  MailIcon,
  ShieldCheckIcon,
  UserPlusIcon,
  UsersRoundIcon,
  XIcon,
} from '@lucide/vue';
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { api, ApiError } from '../api';
import { auth } from '../auth';
import AdminAiSettings from '../components/AdminAiSettings.vue';

type AdminTeacher = {
  id: number;
  name: string;
  email: string;
  active: boolean;
  mustChangePassword: boolean;
  invitationEmailSent?: boolean;
};

const teachers = ref<AdminTeacher[]>([]);
const loading = ref(true);
const saving = ref(false);
const modalOpen = ref(false);
const error = ref('');
const message = ref('');
const warning = ref('');
const form = reactive({ name: '', email: '' });

async function loadTeachers() {
  loading.value = true;
  error.value = '';
  try {
    teachers.value = await api<AdminTeacher[]>('/admin/teachers');
  } catch {
    error.value = 'No se pudieron cargar los docentes. Inténtalo de nuevo.';
  } finally {
    loading.value = false;
  }
}

function openCreateTeacher() {
  form.name = '';
  form.email = '';
  error.value = '';
  message.value = '';
  warning.value = '';
  modalOpen.value = true;
}

function closeModal() {
  if (!saving.value) modalOpen.value = false;
}

async function createTeacher() {
  if (saving.value) return;
  error.value = '';
  message.value = '';
  warning.value = '';
  saving.value = true;
  try {
    const created = await api<AdminTeacher>('/admin/teachers', {
      method: 'POST',
      body: JSON.stringify(form),
    });
    teachers.value = [...teachers.value, created].sort((first, second) =>
      first.name.localeCompare(second.name),
    );
    modalOpen.value = false;
    if (created.invitationEmailSent) {
      message.value = `Docente ${created.name} creado. La contraseña temporal fue enviada por correo.`;
    } else {
      warning.value = `Docente ${created.name} creado, pero el correo de invitación no pudo enviarse.`;
    }
  } catch (cause) {
    error.value = cause instanceof ApiError && cause.status === 409
      ? 'Ya existe una cuenta con ese correo.'
      : 'No se pudo crear el docente. Inténtalo de nuevo.';
  } finally {
    saving.value = false;
  }
}

function handleEscape(event: KeyboardEvent) {
  if (event.key === 'Escape' && modalOpen.value) closeModal();
}

watch(modalOpen, (open) => document.body.classList.toggle('modal-open', open));

onMounted(() => {
  window.addEventListener('keydown', handleEscape);
  void loadTeachers();
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleEscape);
  document.body.classList.remove('modal-open');
});
</script>

<template>
  <main class="page admin-page">
    <section class="page-heading">
      <div>
        <span class="eyebrow">Administración de acceso</span>
        <h1>Hola, {{ auth.user?.name }}</h1>
        <p>Registra las cuentas docentes. Cada docente administrará sus propias clases.</p>
      </div>
      <button class="button primary" type="button" @click="openCreateTeacher">
        <UserPlusIcon class="ui-icon" aria-hidden="true" />
        Agregar docente
      </button>
    </section>

    <p v-if="message" class="alert success" role="status">{{ message }}</p>
    <p v-if="warning" class="alert warning" role="alert">{{ warning }}</p>
    <p v-if="error && !modalOpen" class="alert error" role="alert">{{ error }}</p>

    <section class="section-block">
      <div class="admin-section-heading">
        <div>
          <span class="eyebrow">Cuentas autorizadas</span>
          <h2>Docentes</h2>
        </div>
        <span class="admin-count" aria-label="Cantidad de docentes">
          <UsersRoundIcon class="ui-icon" aria-hidden="true" />
          {{ teachers.length }}
        </span>
      </div>

      <div v-if="loading" class="panel empty-state" role="status" aria-live="polite" aria-busy="true">
        <LoaderCircleIcon class="ui-icon icon-spin" aria-hidden="true" />
        Cargando docentes…
      </div>

      <div v-else-if="teachers.length" class="admin-teacher-grid">
        <article v-for="teacher in teachers" :key="teacher.id" class="admin-teacher-card">
          <div class="admin-teacher-avatar" aria-hidden="true">
            {{ teacher.name.charAt(0).toUpperCase() }}
          </div>
          <div class="admin-teacher-data">
            <div class="admin-teacher-title">
              <h3>{{ teacher.name }}</h3>
              <span class="status" :data-status="teacher.active ? 'evaluated' : undefined">
                {{ teacher.active ? 'Activo' : 'Inactivo' }}
              </span>
            </div>
            <span class="admin-teacher-email">
              <MailIcon class="ui-icon" aria-hidden="true" />
              {{ teacher.email }}
            </span>
            <small v-if="teacher.mustChangePassword">
              <ShieldCheckIcon class="ui-icon" aria-hidden="true" />
              Cambio de contraseña pendiente
            </small>
          </div>
        </article>
      </div>

      <div v-else-if="error" class="panel empty-state">
        <button class="button secondary" type="button" @click="loadTeachers">Reintentar carga</button>
      </div>
      <div v-else class="panel empty-state">
        <UsersRoundIcon class="admin-empty-icon" aria-hidden="true" />
        <h3>Aún no hay docentes registrados</h3>
        <p>Crea la primera cuenta para que el docente pueda configurar sus clases.</p>
        <button class="button primary" type="button" @click="openCreateTeacher">
          <UserPlusIcon class="ui-icon" aria-hidden="true" />
          Agregar primer docente
        </button>
      </div>
    </section>

    <AdminAiSettings />

    <div v-if="modalOpen" class="modal-backdrop" @click.self="closeModal">
      <section class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="create-teacher-title">
        <header class="modal-header">
          <div>
            <span class="eyebrow">Nueva cuenta</span>
            <h2 id="create-teacher-title">Agregar docente</h2>
            <p class="muted">Recibirá una contraseña temporal en su correo institucional.</p>
          </div>
          <button class="modal-close" type="button" aria-label="Cerrar" :disabled="saving" @click="closeModal">
            <XIcon class="ui-icon" aria-hidden="true" />
          </button>
        </header>

        <form class="modal-body" :aria-busy="saving" @submit.prevent="createTeacher">
          <label>
            Nombre completo
            <input v-model.trim="form.name" type="text" minlength="2" maxlength="120" autocomplete="name" :disabled="saving" required />
          </label>
          <label>
            Correo institucional
            <input v-model.trim="form.email" type="email" maxlength="254" autocomplete="email" :disabled="saving" required />
          </label>
          <p v-if="error" class="alert error" role="alert">{{ error }}</p>
          <div class="modal-actions">
            <button class="button secondary" type="button" :disabled="saving" @click="closeModal">Cancelar</button>
            <button class="button primary" type="submit" :disabled="saving" :aria-busy="saving">
              <LoaderCircleIcon v-if="saving" class="ui-icon icon-spin" aria-hidden="true" />
              <UserPlusIcon v-else class="ui-icon" aria-hidden="true" />
              {{ saving ? 'Creando…' : 'Crear docente' }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </main>
</template>

<style scoped>
.admin-page { max-width: 1120px; }
.admin-section-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; }
.admin-section-heading h2 { margin: .2rem 0 0; }
.admin-count { display: inline-flex; align-items: center; gap: .4rem; padding: .5rem .75rem; color: var(--green); background: var(--green-light); border-radius: 999px; font-weight: 700; }
.admin-teacher-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem; }
.admin-teacher-card { display: flex; align-items: flex-start; gap: 1rem; min-width: 0; padding: 1.2rem; background: var(--paper); border: 1px solid var(--line); border-radius: 14px 4px 14px 4px; box-shadow: 0 8px 24px rgba(15, 35, 66, .05); }
.admin-teacher-avatar { flex: 0 0 44px; width: 44px; height: 44px; display: grid; place-items: center; color: white; background: var(--primary-solid); border-radius: 12px 3px 12px 3px; font-weight: 800; }
.admin-teacher-data { min-width: 0; flex: 1; display: grid; gap: .55rem; }
.admin-teacher-title { display: flex; align-items: flex-start; justify-content: space-between; gap: .75rem; }
.admin-teacher-title h3 { margin: 0; overflow-wrap: anywhere; }
.admin-teacher-email, .admin-teacher-data small { display: flex; align-items: center; gap: .4rem; color: var(--muted); overflow-wrap: anywhere; }
.admin-teacher-data small { color: #8a6418; }
.admin-empty-icon { width: 2.5rem; height: 2.5rem; margin-bottom: .75rem; color: var(--green); }
.empty-state .ui-icon { vertical-align: middle; }
@media (max-width: 560px) {
  .admin-teacher-grid { grid-template-columns: 1fr; }
  .admin-teacher-title { display: grid; }
}
</style>
