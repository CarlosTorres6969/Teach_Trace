import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  MAX_LEARNING_OUTCOMES,
  MAX_LEARNING_OUTCOME_LENGTH,
  UpdateLearningOutcomesDto,
} from './activities.dto';

describe('UpdateLearningOutcomesDto', () => {
  async function errors(learningOutcomes: unknown) {
    return validate(plainToInstance(UpdateLearningOutcomesDto, { learningOutcomes }));
  }

  it('acepta y normaliza una lista válida', async () => {
    const input = plainToInstance(UpdateLearningOutcomesDto, {
      learningOutcomes: ['  Analiza fuentes confiables  '],
    });
    await expect(validate(input)).resolves.toHaveLength(0);
    expect(input.learningOutcomes).toEqual(['Analiza fuentes confiables']);
  });

  it('rechaza una lista vacía o formada por espacios', async () => {
    await expect(errors([])).resolves.not.toHaveLength(0);
    await expect(errors(['   '])).resolves.not.toHaveLength(0);
  });

  it('rechaza más de veinte resultados', async () => {
    await expect(
      errors(Array.from({ length: MAX_LEARNING_OUTCOMES + 1 }, (_, index) => `Resultado ${index}`)),
    ).resolves.not.toHaveLength(0);
  });

  it('aplica el límite individual después de trim', async () => {
    await expect(errors([`  ${'a'.repeat(MAX_LEARNING_OUTCOME_LENGTH)}  `])).resolves.toHaveLength(0);
    await expect(errors(['a'.repeat(MAX_LEARNING_OUTCOME_LENGTH + 1)])).resolves.not.toHaveLength(0);
  });
});
