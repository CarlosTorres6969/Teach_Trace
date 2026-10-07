export const AI_STAGES = [
  { key: 'aiUsage', title: 'Evaluación del uso de IA' },
  { key: 'suggestedGrade', title: 'Calcular posible nota' },
  { key: 'feedback', title: 'Comentarios: qué hizo bien y qué hizo mal' },
  { key: 'understanding', title: 'Comentarios: comprensión del tema' },
  { key: 'indicators', title: 'Indicadores: pensamiento crítico, autonomía y autenticidad' },
] as const;

export type AiStageKey = typeof AI_STAGES[number]['key'];
export type AiStageInstructions = Record<AiStageKey, string>;

export const DEFAULT_STAGE_INSTRUCTIONS: AiStageInstructions = {
  aiUsage: 'Analiza los prompts, la conversación y el producto para estimar el nivel de uso de IA. Distingue autoría propia, apoyo mínimo y trabajo generado principalmente por IA. No infieras el uso solo por el estilo de redacción. Si no hay evidencia suficiente, indica que no es determinable.',
  suggestedGrade: 'Valora cada criterio de la rúbrica con niveles de 1 a 4 y justifica cada nivel con evidencia de la entrega. Si falta evidencia, deja el nivel sin determinar. La aplicación calculará la posible nota a partir de estos niveles; la decisión final corresponde al docente.',
  feedback: 'Explica con ejemplos concretos qué hizo bien el estudiante y qué debe mejorar. Usa un tono respetuoso y formativo. Ofrece recomendaciones específicas y realizables; no inventes errores ni fortalezas.',
  understanding: 'Evalúa si el estudiante comprende el tema, el propósito de la actividad y los resultados de aprendizaje. Identifica explicaciones propias, relaciones entre ideas y decisiones justificadas. No confundas buena redacción con comprensión. Explica los vacíos de comprensión con evidencia.',
  indicators: 'Considera pensamiento crítico, autonomía y autenticidad al justificar los criterios aplicables y comentar el proceso. Busca contraste de fuentes, decisiones propias y coherencia entre bitácora, prompts y producto. Valora el pensamiento crítico de los prompts con evidencia. No afirmes falta de autenticidad sin sustento ni inventes indicadores numéricos fuera de la rúbrica.',
};
