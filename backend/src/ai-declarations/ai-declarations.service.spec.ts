import { ConflictException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SubmitEvidenceDto } from '../submissions/submit-evidence.dto';
import { AiDeclarationsService } from './ai-declarations.service';
import { UpdateAiDeclarationDto } from './update-ai-declaration.dto';

describe('AiDeclarationsService', () => {
  const validInput = {
    toolName: 'ChatGPT',
    usageLevel: 2,
    purpose: 'Contrastar',
    promptSummary: 'Consulta',
  };

  it.each([1, 2, 3])('acepta el nivel declarado %i', async (usageLevel) => {
    const dto = plainToInstance(UpdateAiDeclarationDto, {
      ...validInput,
      usageLevel,
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it.each([undefined, null, 0, 4, 1.5, true, false, '2'])(
    'rechaza un nivel declarado inválido o de tipo incorrecto: %p',
    async (usageLevel) => {
      const dto = plainToInstance(UpdateAiDeclarationDto, {
        ...validInput,
        usageLevel,
      });

      expect(await validate(dto)).not.toHaveLength(0);
    },
  );

  it.each(['1', '2', '3'])(
    'acepta la cadena numérica %s recibida en una entrega multipart',
    async (usageLevel) => {
      const dto = plainToInstance(SubmitEvidenceDto, {
        ...validInput,
        usageLevel,
        productText: 'Producto académico',
        productUrl: '',
      });

      expect(await validate(dto)).toHaveLength(0);
      expect(dto.usageLevel).toBe(Number(usageLevel));
    },
  );

  it.each(['0', '4', '1.5', '', null, true, false])(
    'rechaza el nivel multipart inválido: %p',
    async (usageLevel) => {
      const dto = plainToInstance(SubmitEvidenceDto, {
        ...validInput,
        usageLevel,
        productText: 'Producto académico',
        productUrl: '',
      });

      expect(await validate(dto)).not.toHaveLength(0);
    },
  );
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

  it('acepta párrafos y conserva sus saltos de línea al normalizar el propósito', async () => {
    const dto = plainToInstance(UpdateAiDeclarationDto, {
      ...validInput,
      purpose: '  Primer párrafo.\n\nSegundo párrafo.  ',
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.purpose).toBe('Primer párrafo.\n\nSegundo párrafo.');
  });

  it('acepta exactamente 5 000 caracteres en el propósito', async () => {
    const dto = plainToInstance(UpdateAiDeclarationDto, {
      ...validInput,
      purpose: `  ${'a'.repeat(5000)}  `,
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.purpose).toHaveLength(5000);
  });

  it.each([undefined, null, '', '   ', 42, 'a'.repeat(5001)])(
    'rechaza un propósito vacío, inválido o demasiado extenso: %p',
    async (purpose) => {
      const dto = plainToInstance(UpdateAiDeclarationDto, { ...validInput, purpose });

      expect(await validate(dto)).not.toHaveLength(0);
    },
  );

  it('aplica la misma validación del propósito a la entrega multipart', async () => {
    const dto = plainToInstance(SubmitEvidenceDto, {
      ...validInput,
      usageLevel: '2',
      purpose: '   ',
      productText: 'Producto académico',
      productUrl: '',
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
      purpose: '  Contrastar fuentes.\n\nDocumentar decisiones.  ',
      promptSummary: '  Comparar argumentos  ',
    });

    expect(declarations.save).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'Gemini',
        purpose: 'Contrastar fuentes.\n\nDocumentar decisiones.',
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
