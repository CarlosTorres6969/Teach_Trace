<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api';
import { auth } from '../auth';
import type { ForumPost, ForumThread, ForumThreadPage } from '../types';

const route = useRoute();
const router = useRouter();
const classId = Number(route.params.classId);
const pageData = ref<ForumThreadPage | null>(null);
const selectedThread = ref<ForumThread | null>(null);
const loading = ref(true);
const threadLoading = ref(false);
const saving = ref(false);
const error = ref('');
const query = ref('');
const page = ref(1);
const showNewThread = ref(false);
const newThread = reactive({ title: '', description: '' });
const replyBody = ref('');
const replyingTo = ref<ForumPost | null>(null);

const isTeacher = computed(() => auth.user?.role === 'teacher');
const canResolve = computed(() =>
  Boolean(
    selectedThread.value &&
      (isTeacher.value || selectedThread.value.author.id === auth.user?.id),
  ),
);
const backPath = computed(() => (isTeacher.value ? '/teacher' : '/student'));

async function loadThreads(targetPage = page.value) {
  loading.value = true;
  error.value = '';
  try {
    const params = new URLSearchParams({ page: String(targetPage) });
    if (query.value.trim()) params.set('q', query.value.trim());
    pageData.value = await api<ForumThreadPage>(
      `/forum/classes/${classId}/threads?${params.toString()}`,
    );
    page.value = pageData.value.page;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo cargar el foro';
  } finally {
    loading.value = false;
  }
}

async function openThread(threadId: number, updateUrl = true) {
  threadLoading.value = true;
  error.value = '';
  replyingTo.value = null;
  replyBody.value = '';
  try {
    selectedThread.value = await api<ForumThread>(`/forum/threads/${threadId}`);
    if (updateUrl) {
      await router.replace({ query: { ...route.query, thread: String(threadId) } });
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo abrir el hilo';
  } finally {
    threadLoading.value = false;
  }
}

async function createThread() {
  if (saving.value) return;
  saving.value = true;
  error.value = '';
  try {
    const created = await api<ForumThread>(`/forum/classes/${classId}/threads`, {
      method: 'POST',
      body: JSON.stringify(newThread),
    });
    Object.assign(newThread, { title: '', description: '' });
    showNewThread.value = false;
    await loadThreads(1);
    await openThread(created.id);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo crear el hilo';
  } finally {
    saving.value = false;
  }
}

async function sendReply() {
  if (!selectedThread.value || saving.value || !replyBody.value.trim()) return;
  saving.value = true;
  error.value = '';
  try {
    await api(`/forum/threads/${selectedThread.value.id}/posts`, {
      method: 'POST',
      body: JSON.stringify({
        body: replyBody.value,
        ...(replyingTo.value ? { parentPostId: replyingTo.value.id } : {}),
      }),
    });
    const threadId = selectedThread.value.id;
    replyBody.value = '';
    replyingTo.value = null;
    await Promise.all([openThread(threadId, false), loadThreads()]);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo publicar la respuesta';
  } finally {
    saving.value = false;
  }
}

async function togglePinned() {
  if (!selectedThread.value || !isTeacher.value) return;
  try {
    const thread = selectedThread.value;
    await api(`/forum/threads/${thread.id}/pinned`, {
      method: 'PATCH',
      body: JSON.stringify({ pinned: !thread.pinned }),
    });
    await Promise.all([openThread(thread.id, false), loadThreads()]);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo destacar el hilo';
  }
}

async function toggleResolved() {
  if (!selectedThread.value || !canResolve.value) return;
  try {
    const thread = selectedThread.value;
    await api(`/forum/threads/${thread.id}/resolved`, {
      method: 'PATCH',
      body: JSON.stringify({ resolved: !thread.resolved }),
    });
    await Promise.all([openThread(thread.id, false), loadThreads()]);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo cambiar el estado del hilo';
  }
}

async function moderatePost(post: ForumPost) {
  if (!isTeacher.value || !selectedThread.value) return;
  if (!window.confirm('¿Eliminar esta publicación del foro?')) return;
  try {
    await api(`/forum/posts/${post.id}`, { method: 'DELETE' });
    await openThread(selectedThread.value.id, false);
    await loadThreads();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo eliminar la publicación';
  }
}

function search() {
  selectedThread.value = null;
  void router.replace({ query: {} });
  void loadThreads(1);
}

function changePage(nextPage: number) {
  if (!pageData.value || nextPage < 1 || nextPage > pageData.value.totalPages) return;
  selectedThread.value = null;
  void loadThreads(nextPage);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-HN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

onMounted(async () => {
  await loadThreads();
  const threadId = Number(route.query.thread);
  if (threadId > 0) await openThread(threadId, false);
});
</script>

<template>
  <main class="page forum-page">
    <RouterLink :to="backPath" class="back-link">← Volver al panel</RouterLink>
    <section class="page-heading compact">
      <div>
        <span class="eyebrow">{{ pageData?.academicClass.code ?? 'Clase' }}</span>
        <h1>Foro de {{ pageData?.academicClass.name ?? 'discusión' }}</h1>
      </div>
      <button class="button primary" type="button" @click="showNewThread = !showNewThread">
        {{ showNewThread ? 'Cancelar' : 'Crear hilo' }}
      </button>
    </section>

    <form v-if="showNewThread" class="panel form-stack forum-new-thread" @submit.prevent="createThread">
      <div><h2>Nueva pregunta</h2><p class="muted">Describe tu duda para que la clase pueda ayudarte.</p></div>
      <label>Título<input v-model.trim="newThread.title" required maxlength="160" /></label>
      <label>
        Descripción
        <textarea v-model.trim="newThread.description" required maxlength="2000" rows="5"></textarea>
        <span class="char-hint muted">{{ newThread.description.length }}/2000</span>
      </label>
      <button class="button primary" type="submit" :disabled="saving">
        {{ saving ? 'Publicando…' : 'Publicar hilo' }}
      </button>
    </form>

    <p v-if="error" class="alert error" role="alert">{{ error }}</p>

    <section class="forum-layout">
      <aside class="panel forum-sidebar">
        <form class="forum-search" role="search" @submit.prevent="search">
          <label for="forum-query" class="sr-only">Buscar por palabra clave</label>
          <input id="forum-query" v-model="query" maxlength="120" placeholder="Buscar en el foro…" />
          <button class="button secondary" type="submit">Buscar</button>
        </form>

        <p v-if="loading" class="muted forum-state">Cargando hilos…</p>
        <div v-else-if="!pageData?.items.length" class="empty-state forum-state">
          No se encontraron hilos.
        </div>
        <button
          v-for="thread in pageData?.items ?? []"
          v-else
          :key="thread.id"
          class="forum-thread-item"
          :class="{ active: selectedThread?.id === thread.id }"
          type="button"
          @click="openThread(thread.id)"
        >
          <span class="forum-thread-title">
            <span v-if="thread.pinned" aria-label="Destacado">★</span>{{ thread.title }}
          </span>
          <span class="forum-thread-meta">
            {{ thread.author.name }} · {{ thread.postCount }} respuesta(s)
          </span>
          <span v-if="thread.resolved" class="forum-resolved-badge">Resuelto</span>
        </button>

        <nav v-if="pageData && pageData.totalPages > 1" class="forum-pagination" aria-label="Páginas del foro">
          <button type="button" :disabled="page <= 1" @click="changePage(page - 1)">Anterior</button>
          <span>{{ page }} de {{ pageData.totalPages }}</span>
          <button type="button" :disabled="page >= pageData.totalPages" @click="changePage(page + 1)">Siguiente</button>
        </nav>
      </aside>

      <article class="panel forum-thread-detail">
        <p v-if="threadLoading" class="muted">Cargando conversación…</p>
        <div v-else-if="!selectedThread" class="empty-state forum-thread-placeholder">
          <h2>Conversaciones de la clase</h2>
          <p>Selecciona un hilo o publica una nueva pregunta.</p>
        </div>
        <template v-else>
          <header class="forum-detail-header">
            <div>
              <div class="forum-badges">
                <span v-if="selectedThread.pinned" class="forum-pinned-badge">★ Destacado</span>
                <span v-if="selectedThread.resolved" class="forum-resolved-badge">Resuelto</span>
              </div>
              <h2>{{ selectedThread.title }}</h2>
              <p class="muted">{{ selectedThread.author.name }} · {{ formatDate(selectedThread.createdAt) }}</p>
            </div>
            <div class="forum-detail-actions">
              <button v-if="isTeacher" class="button ghost" type="button" @click="togglePinned">
                {{ selectedThread.pinned ? 'Quitar destacado' : 'Destacar' }}
              </button>
              <button v-if="canResolve" class="button secondary" type="button" @click="toggleResolved">
                {{ selectedThread.resolved ? 'Reabrir' : 'Marcar resuelto' }}
              </button>
            </div>
          </header>

          <div class="forum-thread-description">{{ selectedThread.description }}</div>

          <section class="forum-posts" aria-label="Respuestas">
            <h3>Respuestas ({{ selectedThread.posts.length }})</h3>
            <p v-if="!selectedThread.posts.length" class="muted">Aún no hay respuestas.</p>
            <article
              v-for="post in selectedThread.posts"
              :key="post.id"
              class="forum-post"
              :class="{ 'forum-post--nested': post.parentPostId }"
            >
              <header>
                <strong>{{ post.author.name }}</strong>
                <span v-if="post.author.role === 'teacher'" class="teacher-badge">Docente</span>
                <small>{{ formatDate(post.createdAt) }}</small>
              </header>
              <p>{{ post.body }}</p>
              <footer>
                <button
                  v-if="!post.parentPostId"
                  class="text-button"
                  type="button"
                  @click="replyingTo = post"
                >Responder</button>
                <button v-if="isTeacher" class="text-button danger-text" type="button" @click="moderatePost(post)">
                  Eliminar
                </button>
              </footer>
            </article>
          </section>

          <form class="forum-reply-form" @submit.prevent="sendReply">
            <div class="forum-reply-heading">
              <strong>{{ replyingTo ? `Responder a ${replyingTo.author.name}` : 'Responder al hilo' }}</strong>
              <button v-if="replyingTo" class="text-button" type="button" @click="replyingTo = null">Cancelar</button>
            </div>
            <textarea v-model.trim="replyBody" required maxlength="2000" rows="4" placeholder="Escribe tu respuesta…"></textarea>
            <div class="forum-reply-footer">
              <span class="muted">{{ replyBody.length }}/2000</span>
              <button class="button primary" type="submit" :disabled="saving || !replyBody.trim()">
                {{ saving ? 'Publicando…' : 'Publicar respuesta' }}
              </button>
            </div>
          </form>
        </template>
      </article>
    </section>
  </main>
</template>
