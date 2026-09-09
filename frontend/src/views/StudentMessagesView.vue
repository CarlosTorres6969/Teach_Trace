<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api';
import { auth } from '../auth';
import type { ConversationSummary, ConversationThread, MessageItem } from '../types';

const route = useRoute();
const router = useRouter();

// ─── Estado principal ─────────────────────────────────────────────────────────
const conversations = ref<ConversationSummary[]>([]);
const active = ref<ConversationThread | null>(null);
const loadingList = ref(true);
const loadingThread = ref(false);
const error = ref('');
const replyBody = ref('');
const sendingReply = ref(false);

// ─── Modal nueva conversación ─────────────────────────────────────────────────
const showModal = ref(false);
const newSubject = ref('');
const newBody = ref('');
const newTeacherId = ref<number | null>(null);
const submissionId = ref<number | null>(null); // pre-llenado desde query param
const submitting = ref(false);
const modalError = ref('');

// Teachers disponibles (docentes de las clases del estudiante)
type TeacherOption = { id: number; name: string };
const teachers = ref<TeacherOption[]>([]);

async function loadConversations() {
  loadingList.value = true;
  try {
    conversations.value = await api<ConversationSummary[]>('/student/messages');
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Error al cargar mensajes';
  } finally {
    loadingList.value = false;
  }
}

async function openThread(id: number) {
  loadingThread.value = true;
  active.value = null;
  await router.push(`/student/messages/${id}`);
  try {
    active.value = await api<ConversationThread>(`/student/messages/${id}`);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Error al cargar conversación';
  } finally {
    loadingThread.value = false;
  }
}

async function sendReply() {
  if (!active.value || !replyBody.value.trim() || sendingReply.value) return;
  sendingReply.value = true;
  try {
    const msg = await api<MessageItem>(`/student/messages/${active.value.id}/reply`, {
      method: 'POST',
      body: JSON.stringify({ body: replyBody.value.trim() }),
    });
    active.value.messages.push(msg);
    replyBody.value = '';
    await loadConversations();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Error al enviar respuesta';
  } finally {
    sendingReply.value = false;
  }
}

async function openModal(preSubmissionId?: number) {
  modalError.value = '';
  newSubject.value = '';
  newBody.value = '';
  newTeacherId.value = null;
  submissionId.value = preSubmissionId ?? null;

  // Cargar docentes de las clases del estudiante
  try {
    type ActivityItem = { academicClass?: { teacher?: TeacherOption } | null };
    const activities = await api<ActivityItem[]>('/student/activities');
    const seen = new Map<number, TeacherOption>();
    // Los teachers vienen en la actividad a través del endpoint de la clase;
    // como fallback usamos la lista de conversaciones existentes
    conversations.value.forEach((c) => {
      if (c.with.role === 'teacher' && !seen.has(c.with.id)) {
        seen.set(c.with.id, { id: c.with.id, name: c.with.name });
      }
    });
    void activities; // guardado para futura integración directa
    teachers.value = [...seen.values()];
  } catch { /* silencioso */ }

  showModal.value = true;
}

async function submitConversation() {
  if (!newSubject.value.trim() || !newBody.value.trim()) {
    modalError.value = 'El asunto y el mensaje son obligatorios.';
    return;
  }
  if (!newTeacherId.value) {
    modalError.value = 'Selecciona un docente.';
    return;
  }
  submitting.value = true;
  modalError.value = '';
  try {
    const conv = await api<ConversationSummary>('/student/messages', {
      method: 'POST',
      body: JSON.stringify({
        subject: newSubject.value.trim(),
        body: newBody.value.trim(),
        teacherId: newTeacherId.value,
        ...(submissionId.value ? { submissionId: submissionId.value } : {}),
      }),
    });
    showModal.value = false;
    await loadConversations();
    await openThread(conv.id);
  } catch (cause) {
    modalError.value = cause instanceof Error ? cause.message : 'Error al enviar mensaje';
  } finally {
    submitting.value = false;
  }
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-HN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Abrir hilo si la URL ya trae un :id
watch(
  () => route.params.id,
  async (id) => {
    if (id) await openThread(Number(id));
  },
  { immediate: false },
);

// Abrir modal pre-llenado si viene ?submissionId=X
onMounted(async () => {
  await loadConversations();
  const sid = route.query.submissionId;
  const tid = route.query.teacherId;
  if (route.params.id) {
    await openThread(Number(route.params.id));
  } else if (sid && tid) {
    newTeacherId.value = Number(tid);
    await openModal(Number(sid));
  }
});
</script>

<template>
  <main class="page messages-layout">
    <!-- Sidebar: lista de conversaciones -->
    <aside class="messages-sidebar panel">
      <div class="messages-sidebar-header">
        <h2>Mensajes</h2>
        <button class="button primary" type="button" @click="openModal()">+ Nuevo</button>
      </div>

      <p v-if="loadingList" class="muted messages-loading">Cargando…</p>
      <p v-else-if="!conversations.length" class="muted messages-empty">
        No tienes conversaciones aún.
      </p>
      <ul v-else class="messages-list">
        <li
          v-for="conv in conversations"
          :key="conv.id"
          class="messages-list-item"
          :class="{ 'messages-list-item--active': active?.id === conv.id, 'messages-list-item--resolved': conv.status === 'resolved' }"
          @click="openThread(conv.id)"
        >
          <div class="messages-list-meta">
            <strong>{{ conv.with.name }}</strong>
            <span class="messages-list-date">{{ formatDate(conv.updatedAt) }}</span>
          </div>
          <p class="messages-list-subject">{{ conv.subject }}</p>
          <span class="messages-list-status" :data-status="conv.status">
            {{ conv.status === 'resolved' ? 'Resuelta' : 'Abierta' }}
          </span>
        </li>
      </ul>
    </aside>

    <!-- Área principal: hilo de mensajes -->
    <section class="messages-thread panel">
      <p v-if="error" class="alert error">{{ error }}</p>

      <div v-if="loadingThread" class="messages-thread-empty muted">Cargando conversación…</div>

      <template v-else-if="active">
        <div class="messages-thread-header">
          <div>
            <span class="eyebrow">Conversación con {{ active.with.name }}</span>
            <h2>{{ active.subject }}</h2>
          </div>
          <span :data-status="active.status" class="status">
            {{ active.status === 'resolved' ? 'Resuelta' : 'Abierta' }}
          </span>
        </div>

        <div class="messages-bubble-list">
          <div
            v-for="msg in active.messages"
            :key="msg.id"
            class="messages-bubble"
            :class="msg.sender.id === auth.user?.id ? 'messages-bubble--mine' : 'messages-bubble--theirs'"
          >
            <div class="messages-bubble-meta">
              <strong>{{ msg.sender.id === auth.user?.id ? 'Tú' : msg.sender.name }}</strong>
              <small>{{ formatDate(msg.createdAt) }}</small>
            </div>
            <p>{{ msg.body }}</p>
          </div>
        </div>

        <!-- Caja de respuesta -->
        <form
          v-if="active.status === 'open'"
          class="messages-reply-form"
          @submit.prevent="sendReply"
        >
          <textarea
            v-model="replyBody"
            rows="3"
            maxlength="1000"
            placeholder="Escribe tu respuesta…"
            required
          />
          <div class="messages-reply-footer">
            <small class="muted">{{ replyBody.length }}/1000</small>
            <button class="button primary" type="submit" :disabled="sendingReply || !replyBody.trim()">
              {{ sendingReply ? 'Enviando…' : 'Enviar' }}
            </button>
          </div>
        </form>
        <p v-else class="alert messages-resolved-note">Esta conversación fue marcada como resuelta por el docente.</p>
      </template>

      <div v-else class="messages-thread-empty">
        <p class="muted">Selecciona una conversación o inicia una nueva.</p>
        <button class="button primary" type="button" @click="openModal()">Consultar al docente</button>
      </div>
    </section>

    <!-- Modal nueva conversación -->
    <div v-if="showModal" class="modal-backdrop" @click.self="showModal = false">
      <section class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="new-conv-title">
        <header class="modal-header">
          <div>
            <span class="eyebrow">Nueva consulta</span>
            <h2 id="new-conv-title">Enviar mensaje al docente</h2>
          </div>
          <button class="modal-close" type="button" aria-label="Cerrar" @click="showModal = false">×</button>
        </header>
        <form class="modal-body form-stack" @submit.prevent="submitConversation">
          <p v-if="modalError" class="alert error">{{ modalError }}</p>

          <label>
            Docente
            <select v-model.number="newTeacherId" required>
              <option :value="null" disabled>Selecciona un docente</option>
              <option v-for="t in teachers" :key="t.id" :value="t.id">{{ t.name }}</option>
            </select>
            <span v-if="!teachers.length" class="field-hint muted">
              Primero necesitas tener al menos una conversación o actividad con un docente.
            </span>
          </label>

          <label>
            Asunto
            <input v-model="newSubject" maxlength="160" required placeholder="Ej: Duda sobre mi calificación en Criterio 3" />
            <span class="char-hint muted">{{ newSubject.length }}/160</span>
          </label>

          <label>
            Mensaje
            <textarea v-model="newBody" rows="5" maxlength="1000" required placeholder="Describe tu consulta con detalle…" />
            <span class="char-hint muted">{{ newBody.length }}/1000</span>
          </label>

          <div class="modal-actions">
            <button class="button secondary" type="button" @click="showModal = false">Cancelar</button>
            <button class="button primary" type="submit" :disabled="submitting">
              {{ submitting ? 'Enviando…' : 'Enviar mensaje' }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </main>
</template>
