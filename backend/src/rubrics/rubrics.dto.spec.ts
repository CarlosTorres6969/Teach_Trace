import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AssociateRubricDto, CreateRubricDto } from './rubrics.dto';

function criterion(index: number) {
  return {
    name: `Criterio ${index}`,
    dimension: `Dimensión ${index}`,
    descriptors: {
      level1: 'Descriptor 1',
      level2: 'Descriptor 2',
      level3: 'Descriptor 3',
      level4: 'Descriptor 4',
    },
  };
}

function rubricInput() {
  return {
    name: 'Rúbrica del piloto',
    criteria: Array.from({ length: 7 }, (_, index) => criterion(index + 1)),
  };
}

function cloneInput() {
  return structuredClone(rubricInput());
}

describe('CreateRubricDto', () => {
  it('acepta exactamente siete dimensiones con cuatro niveles', async () => {
    const dto = plainToInstance(CreateRubricDto, rubricInput());

    expect(await validate(dto)).toHaveLength(0);
  });

  it.each([6, 8])('rechaza una rúbrica con %i dimensiones', async (total) => {
    const input = rubricInput();
    input.criteria = Array.from({ length: total }, (_, index) => criterion(index + 1));
    const dto = plainToInstance(CreateRubricDto, input);

    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('rechaza dimensiones y nombres de criterios duplicados ignorando espacios y mayúsculas', async () => {
    const duplicatedDimension = cloneInput();
    duplicatedDimension.criteria[1].dimension = '  DIMENSIÓN 1  ';
    await expect(
      validate(plainToInstance(CreateRubricDto, duplicatedDimension)),
    ).resolves.not.toHaveLength(0);

    const duplicatedName = cloneInput();
    duplicatedName.criteria[1].name = '  CRITERIO 1  ';
    await expect(
      validate(plainToInstance(CreateRubricDto, duplicatedName)),
    ).resolves.not.toHaveLength(0);
  });

  it.each([
    ['nombre de la rúbrica', (input: ReturnType<typeof rubricInput>) => { input.name = '   '; }],
    ['nombre del criterio', (input: ReturnType<typeof rubricInput>) => { input.criteria[0].name = '   '; }],
    ['dimensión', (input: ReturnType<typeof rubricInput>) => { input.criteria[0].dimension = '   '; }],
    ['descriptor', (input: ReturnType<typeof rubricInput>) => { input.criteria[0].descriptors.level1 = '   '; }],
  ])('rechaza %s cuando solo contiene espacios', async (_field, mutate) => {
    const input = cloneInput();
    mutate(input);

    expect(await validate(plainToInstance(CreateRubricDto, input))).not.toHaveLength(0);
  });

  it.each(['level1', 'level2', 'level3', 'level4'] as const)(
    'rechaza la ausencia individual de %s',
    async (level) => {
      const input = cloneInput();
      Reflect.deleteProperty(input.criteria[0].descriptors, level);

      expect(await validate(plainToInstance(CreateRubricDto, input))).not.toHaveLength(0);
    },
  );

  it.each(['', '   '])('rechaza un descriptor vacío o con espacios: %j', async (value) => {
    const input = cloneInput();
    input.criteria[0].descriptors.level1 = value;

    expect(await validate(plainToInstance(CreateRubricDto, input))).not.toHaveLength(0);
  });

  it.each([123, null, {}, []])('rechaza un descriptor con tipo incorrecto: %j', async (value) => {
    const input = cloneInput();
    const descriptors = input.criteria[0].descriptors as unknown as Record<string, unknown>;
    descriptors.level1 = value;

    expect(await validate(plainToInstance(CreateRubricDto, input))).not.toHaveLength(0);
  });

  it('acepta 1000 caracteres y rechaza 1001 en un descriptor', async () => {
    const maximum = cloneInput();
    maximum.criteria[0].descriptors.level1 = 'a'.repeat(1000);
    await expect(
      validate(plainToInstance(CreateRubricDto, maximum)),
    ).resolves.toHaveLength(0);

    const tooLong = cloneInput();
    tooLong.criteria[0].descriptors.level1 = 'a'.repeat(1001);
    await expect(
      validate(plainToInstance(CreateRubricDto, tooLong)),
    ).resolves.not.toHaveLength(0);
  });

  it('rechaza un nivel adicional no permitido', async () => {
    const input = cloneInput();
    const descriptors = input.criteria[0].descriptors as unknown as Record<string, unknown>;
    descriptors.level5 = 'Nivel adicional';
    const dto = plainToInstance(CreateRubricDto, input);

    expect(
      await validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ).not.toHaveLength(0);
  });

  it('rechaza descriptores duplicados ignorando espacios y mayúsculas', async () => {
    const input = cloneInput();
    input.criteria[0].descriptors.level2 = '  DESCRIPTOR 1  ';

    expect(await validate(plainToInstance(CreateRubricDto, input))).not.toHaveLength(0);
  });

  it('normaliza espacios en nombre, criterios, dimensiones y descriptores', async () => {
    const input = cloneInput();
    input.name = '  Rúbrica normalizada  ';
    input.criteria[0] = {
      name: '  Criterio normalizado  ',
      dimension: '  Dimensión normalizada  ',
      descriptors: {
        level1: '  Nivel inicial  ',
        level2: '  Nivel básico  ',
        level3: '  Nivel competente  ',
        level4: '  Nivel avanzado  ',
      },
    };
    const dto = plainToInstance(CreateRubricDto, input);

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.name).toBe('Rúbrica normalizada');
    expect(dto.criteria[0]).toEqual({
      name: 'Criterio normalizado',
      dimension: 'Dimensión normalizada',
      descriptors: {
        level1: 'Nivel inicial',
        level2: 'Nivel básico',
        level3: 'Nivel competente',
        level4: 'Nivel avanzado',
      },
    });
  });
});

describe('AssociateRubricDto', () => {
  it('acepta solamente identificadores enteros positivos', async () => {
    await expect(
      validate(plainToInstance(AssociateRubricDto, { rubricId: 1 })),
    ).resolves.toHaveLength(0);

    for (const rubricId of [0, -1, 1.5, '1', null]) {
      await expect(
        validate(plainToInstance(AssociateRubricDto, { rubricId })),
      ).resolves.not.toHaveLength(0);
    }
  });
});
