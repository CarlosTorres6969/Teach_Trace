import { ConflictException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AiDeclarationsService } from './ai-declarations.service';
import { UpdateAiDeclarationDto } from './update-ai-declaration.dto';

describe('AiDeclarationsService', () => {
  const validInput = {
    toolName: 'ChatGPT',
    usageLevel: 2,
    purpose: 'Contrastar',
    promptSummary: 'Consulta',
  };

  it('rechaza niveles declarados fuera del rango 1-3', async () => {
    const dto = plainToInstance(UpdateAiDeclarationDto, {
      ...validInput,
      usageLevel: 4,
    });

    expect(await validate(dto)).not.toHaveLength(0);
  });

  it.each([undefined, '', '   ', 42, 'a'.repeat(121)])(
    'rechaza un nombre de herramienta invalido: %p',
    async (toolName) => {
      const dto = plainToInstance(UpdateAiDeclarationDto, { ...validInput, toolName });

      expect(await validate(dto)).not.toHaveLength(0);
    },
  );

  it('normaliza el nombre de la herramienta antes de validarlo', async () => {
    const dto = plainToInstance(UpdateAiDeclarationDto, {
      ...validInput,
      toolName: '  Claude  ',
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.toolName).toBe('Claude');
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
    const submissions = { findOne: jest.fn().mockResolvedValue(null) };
    const activitiesService = {
      getForStudent: jest.fn().mockResolvedValue({ id: 9, title: 'Actividad' }),
    };
    const service = new AiDeclarationsService(
      declarations as never,
      submissions as never,
      activitiesService as never,
    );

    await service.update({ id: 4 } as never, 9, validInput);

    expect(declaration.usageDiscrepancy).toBe(true);
  });

  it('normaliza todos los textos antes de persistir la declaracion', async () => {
    const declaration = { detectedUsageLevel: null, usageDiscrepancy: false };
    const declarations = {
      findOne: jest.fn().mockResolvedValue(declaration),
      save: jest.fn(async (value) => value),
    };
    const submissions = { findOne: jest.fn().mockResolvedValue(null) };
    const activitiesService = {
      getForStudent: jest.fn().mockResolvedValue({ id: 9, title: 'Actividad' }),
    };
    const service = new AiDeclarationsService(
      declarations as never,
      submissions as never,
      activitiesService as never,
    );

    await service.update({ id: 4 } as never, 9, {
      ...validInput,
      toolName: '  Gemini  ',
      purpose: '  Contrastar fuentes  ',
      promptSummary: '  Comparar argumentos  ',
    });

    expect(declarations.save).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'Gemini',
        purpose: 'Contrastar fuentes',
        promptSummary: 'Comparar argumentos',
      }),
    );
  });

  it('impide modificar directamente la declaracion despues de entregar', async () => {
    const declarations = { findOne: jest.fn(), save: jest.fn() };
    const submissions = { findOne: jest.fn().mockResolvedValue({ submittedAt: new Date() }) };
    const activitiesService = {
      getForStudent: jest.fn().mockResolvedValue({ id: 9, title: 'Actividad' }),
    };
    const service = new AiDeclarationsService(
      declarations as never,
      submissions as never,
      activitiesService as never,
    );

    await expect(service.update({ id: 4 } as never, 9, validInput)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(declarations.save).not.toHaveBeenCalled();
  });
});
