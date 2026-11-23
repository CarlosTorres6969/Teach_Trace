import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  MAX_LEARNING_OUTCOMES,
  MAX_LEARNING_OUTCOME_LENGTH,
  UpdateLearningOutcomesDto,
  UpdateActivityTitleDto,
  PrepareTeacherContextUploadDto,
} from './activities.dto';

describe('Edición del nombre y documento privado', () => {
  it.each(['', '   ', 'a'.repeat(161), null])('rechaza un nombre inválido', async (title) => {
    expect(await validate(plainToInstance(UpdateActivityTitleDto, { title }))).not.toHaveLength(0);
  });
  it('normaliza el nombre sin aceptar campos ajenos', async () => {
    const input = plainToInstance(UpdateActivityTitleDto, { title: '  Nuevo nombre  ' });
    expect(await validate(input)).toHaveLength(0);
    expect(input.title).toBe('Nuevo nombre');
    expect(await validate(plainToInstance(UpdateActivityTitleDto, { title: 'Nombre', published: false }), { whitelist: true, forbidNonWhitelisted: true })).not.toHaveLength(0);
  });
  it.each(['pdf', 'docx'])('acepta documentos .%s de 10 MB', async (extension) => {
    expect(await validate(plainToInstance(PrepareTeacherContextUploadDto, { fileName: `tarea.${extension}`, fileSize: 10 * 1024 * 1024 }))).toHaveLength(0);
  });
  it.each([{ fileName: 'tarea.doc', fileSize: 100 }, { fileName: 'tarea.pdf', fileSize: 10 * 1024 * 1024 + 1 }])('rechaza formatos o tamaños no permitidos', async (input) => {
    expect(await validate(plainToInstance(PrepareTeacherContextUploadDto, input))).not.toHaveLength(0);
  });
});

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
