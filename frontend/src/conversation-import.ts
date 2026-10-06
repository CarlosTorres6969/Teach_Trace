export type ImportedConversationRole = 'student' | 'ai';

export type ImportedConversationMessage = {
  role: ImportedConversationRole;
  content: string;
};

export const MAX_CONVERSATION_FILE_SIZE = 1024 * 1024;
export const MAX_CONVERSATION_MESSAGES = 200;
export const MAX_CONVERSATION_MESSAGE_LENGTH = 20000;

const STUDENT_LABELS = new Set(['estudiante', 'usuario', 'user', 'you']);
const AI_LABELS = new Set([
  'ia',
  'ai',
  'asistente',
  'assistant',
  'chatgpt',
  'gemini',
  'copilot',
  'claude',
]);

function normalizeLabel(label: string) {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('es');
}

function roleFromLabel(label: string): ImportedConversationRole | null {
  const normalized = normalizeLabel(label);
  if (STUDENT_LABELS.has(normalized)) return 'student';
  if (AI_LABELS.has(normalized)) return 'ai';
  return null;
}

function readMarker(line: string) {
  const bracketMatch = line.match(/^\s*\[([^\]]+)\]\s*(.*)$/u);
  if (bracketMatch) {
    const role = roleFromLabel(bracketMatch[1]);
    return role ? { role, content: bracketMatch[2] } : null;
  }

  const colonMatch = line.match(/^\s*([^:]{1,30}):\s*(.*)$/u);
  if (!colonMatch) return null;
  const role = roleFromLabel(colonMatch[1]);
  return role ? { role, content: colonMatch[2] } : null;
}

export function parseConversationText(source: string): ImportedConversationMessage[] {
  const normalizedSource = source.replace(/^\uFEFF/u, '').replace(/\r\n?/g, '\n');
  if (!normalizedSource.trim()) {
    throw new Error('El archivo TXT está vacío.');
  }

  const messages: ImportedConversationMessage[] = [];
  let currentRole: ImportedConversationRole | null = null;
  let currentLines: string[] = [];

  const flushMessage = () => {
    if (!currentRole) return;
    const content = currentLines.join('\n').trim();
    if (!content) {
      throw new Error('Cada participante debe tener un mensaje con contenido.');
    }
    if (content.length > MAX_CONVERSATION_MESSAGE_LENGTH) {
      throw new Error(
        `Cada mensaje puede contener como máximo ${MAX_CONVERSATION_MESSAGE_LENGTH.toLocaleString('es-HN')} caracteres.`,
      );
    }
    messages.push({ role: currentRole, content });
    if (messages.length > MAX_CONVERSATION_MESSAGES) {
      throw new Error(`La conversación puede contener como máximo ${MAX_CONVERSATION_MESSAGES} mensajes.`);
    }
  };

  for (const line of normalizedSource.split('\n')) {
    const marker = readMarker(line);
    if (marker) {
      flushMessage();
      currentRole = marker.role;
      currentLines = [marker.content];
      continue;
    }

    if (!currentRole) {
      if (!line.trim()) continue;
      throw new Error('El archivo debe comenzar con ESTUDIANTE: o IA:.');
    }
    currentLines.push(line);
  }
  flushMessage();

  if (!messages.some((item) => item.role === 'student')) {
    throw new Error('La conversación debe incluir al menos un mensaje del estudiante.');
  }
  if (!messages.some((item) => item.role === 'ai')) {
    throw new Error('La conversación debe incluir al menos una respuesta de IA.');
  }

  return messages;
}
