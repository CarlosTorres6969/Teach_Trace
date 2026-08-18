import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateRubricDto } from './rubrics.dto';

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

describe('CreateRubricDto', () => {
  it('acepta exactamente siete dimensiones con cuatro niveles', async () => {
    const dto = plainToInstance(CreateRubricDto, {
      name: 'Rúbrica del piloto',
      criteria: Array.from({ length: 7 }, (_, index) => criterion(index + 1)),
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('rechaza una rúbrica con menos de siete dimensiones', async () => {
    const dto = plainToInstance(CreateRubricDto, {
      name: 'Rúbrica incompleta',
      criteria: Array.from({ length: 6 }, (_, index) => criterion(index + 1)),
    });

    expect(await validate(dto)).not.toHaveLength(0);
  });
});
