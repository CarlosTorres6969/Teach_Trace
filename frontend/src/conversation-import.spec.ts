import { describe, expect, it } from 'vitest';
import {
  MAX_CONVERSATION_MESSAGE_LENGTH,
  MAX_CONVERSATION_MESSAGES,
  parseConversationText,
} from './conversation-import';

describe('parseConversationText', () => {
  it('importa intervenciones con etiquetas y conserva párrafos', () => {
    expect(parseConversationText(`
ESTUDIANTE:
Necesito una explicación.
Con un ejemplo práctico.

IA: Claro, revisemos el concepto.

ESTUDIANTE: Gracias.
`)).toEqual([
      { role: 'student', content: 'Necesito una explicación.\nCon un ejemplo práctico.' },
      { role: 'ai', content: 'Claro, revisemos el concepto.' },
      { role: 'student', content: 'Gracias.' },
    ]);
  });

  it('acepta el formato entre corchetes usado al exportar la conversación', () => {
    expect(parseConversationText('[Estudiante] Mi consulta\n\n[IA] Mi respuesta')).toEqual([
      { role: 'student', content: 'Mi consulta' },
      { role: 'ai', content: 'Mi respuesta' },
    ]);
  });

  it.each([
    ['', 'El archivo TXT está vacío.'],
    ['Texto sin participante', 'El archivo debe comenzar con ESTUDIANTE: o IA:.'],
    ['ESTUDIANTE: Consulta', 'La conversación debe incluir al menos una respuesta de IA.'],
    ['IA: Respuesta', 'La conversación debe incluir al menos un mensaje del estudiante.'],
    ['ESTUDIANTE:\n\nIA: Respuesta', 'Cada participante debe tener un mensaje con contenido.'],
  ])('rechaza una conversación inválida', (source, expectedMessage) => {
    expect(() => parseConversationText(source)).toThrow(expectedMessage);
  });

  it('rechaza mensajes y conversaciones que exceden los límites del backend', () => {
    const oversizedMessage = 'x'.repeat(MAX_CONVERSATION_MESSAGE_LENGTH + 1);
    expect(() => parseConversationText(`ESTUDIANTE: ${oversizedMessage}\nIA: Respuesta`))
      .toThrow('Cada mensaje puede contener como máximo');

    const tooManyMessages = Array.from(
      { length: MAX_CONVERSATION_MESSAGES + 1 },
      (_, index) => `${index % 2 ? 'IA' : 'ESTUDIANTE'}: Mensaje ${index + 1}`,
    ).join('\n');
    expect(() => parseConversationText(tooManyMessages))
      .toThrow(`La conversación puede contener como máximo ${MAX_CONVERSATION_MESSAGES} mensajes.`);
  });
});
