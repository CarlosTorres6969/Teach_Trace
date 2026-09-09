<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api';
import { auth } from '../auth';
import type { ConversationSummary, ConversationThread, MessageItem } from '../types';

const route = useRoute();
const router = useRouter();

const conversations = ref<ConversationSummary[]>([]);
const active = ref<ConversationThread | null>(null);
const loadingList = ref(true);
const loadingThread = ref(false);
const error = ref('');
const replyBody = ref('');
const sendingReply = ref(false);
const resolving = ref(false);

async function loadConversations() {
  loadingList.value = true;
  try {
    conversations.value = await api<ConversationSummary[]>('/teacher/messages');
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Error al cargar mensajes';
  } finally {
    loadingList.value = false;
  }
}

async function openThread(id: number) {
  loadingThread.value = true;
  active.value = null;
  await router.push(`/teacher/messages/${id}`);
  try {
    active.value = await api<ConversationThread>(`/teacher/messages/${id}`);
    replyBody.value = '';
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
    const msg = await api<MessageItem>(`/teacher/messages/${active.value.id}/reply`, {
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

async function resolveConversation() {
  if (!active.value || resolving.value) return;
  resolving.value = true;
  try {
    await api(`/teacher/messages/${active.value.id}/resolve`, { method: 'PUT' });
    active.value.status = 'resolved';
    await loadConversations();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Error al cerrar conversación';
  } finally {
    resolving.value = false;
  }
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-HN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

onMounted(async () => {
  await loadConversations();
  if (route.params.id) await openThread(Number(route.params.id));
});
</script>

<template>
  <main class="page messages-layout">
    <!-- Sidebar -->
    <aside class="messages-sidebar panel">
      <div class="messages-sidebar-header">
        <h2>Mensajes</h2>
        <span class="muted messages-count">{{ conversations.length }}</span>
      </div>

      <p v-if="loadingList" class="muted messages-loading">Cargando…</p>
      <p v-else-if="!conversations.length" class="muted messages-empty">
        No tienes mensajes de estudiantes aún.
      </p>
      <ul v-else class="messages-list">
        <li
          v-for="conv in conversations"
          :key="conv.id"
          class="messages-list-item"
          :class="{
            'messages-list-item--active': active?.id === conv.id,
            'messages-list-item--resolved': conv.status === 'resolved',
          }"
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

    <!-- Hilo -->
    <section class="messages-thread panel">
      <p v-if="error" class="alert error">{{ error }}</p>

      <div v-if="loadingThread" class="messages-thread-empty muted">Cargando conversación…</div>

      <template v-else-if="active">
        <div class="messages-thread-header">
          <div>
            <span class="eyebrow">Estudiante: {{ active.with.name }}</span>
            <h2>{{ active.subject }}</h2>
          </div>
          <div class="messages-thread-actions">
            <span :data-status="active.status" class="status">
              {{ active.status === 'resolved' ? 'Resuelta' : 'Abierta' }}
            </span>
            <button
              v-if="active.status === 'open'"
              class="button secondary"
              type="button"
              :disabled="resolving"
              @click="resolveConversation"
            >
              {{ resolving ? 'Cerrando…' : 'Marcar resuelta' }}
            </button>
          </div>
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

        <!-- Responder -->
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
              {{ sendingReply ? 'Enviando…' : 'Responder' }}
            </button>
          </div>
        </form>
        <p v-else class="alert messages-resolved-note">Esta conversación fue marcada como resuelta.</p>
      </template>

      <div v-else class="messages-thread-empty">
        <p class="muted">Selecciona una conversación para ver el hilo.</p>
      </div>
    </section>
  </main>
</template>
