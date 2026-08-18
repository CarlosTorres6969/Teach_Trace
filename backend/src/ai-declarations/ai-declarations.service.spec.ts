import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AiDeclarationsService } from './ai-declarations.service';
import { UpdateAiDeclarationDto } from './update-ai-declaration.dto';

describe('AiDeclarationsService', () => {
  it('rechaza niveles declarados fuera del rango 1–3', async () => {
    const dto = plainToInstance(UpdateAiDeclarationDto, {
      toolName: 'ChatGPT',
      usageLevel: 4,
      purpose: 'Contrastar',
      promptSummary: 'Consulta',
    });

    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('marca discrepancia cuando el nivel detectado difiere del declarado', async () => {
    const declaration = {
      usageLevel: 3,
      detectedUsageLevel: 3,
      usageDiscrepancy: false,
    };
    const declarations = {
      findOne: jest.fn().mockResolvedValue(declaration),
      save: jest.fn(async (value) => value),
    };
    const activitiesService = {
      getForStudent: jest.fn().mockResolvedValue({ id: 9, title: 'Actividad' }),
    };
    const service = new AiDeclarationsService(declarations as never, activitiesService as never);

    await service.update({ id: 4 } as never, 9, {
      toolName: 'ChatGPT',
      usageLevel: 2,
      purpose: 'Contrastar',
      promptSummary: 'Consulta',
    });

    expect(declaration.usageDiscrepancy).toBe(true);
  });
});
