import { LogbooksService } from './logbooks.service';

describe('LogbooksService', () => {
  it('actualiza únicamente la bitácora del estudiante autenticado', async () => {
    const student = { id: 4 };
    const activity = { id: 9, title: 'Actividad' };
    const activitiesService = { getForStudent: jest.fn().mockResolvedValue(activity) };
    const logbooks = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => ({ id: 12, ...value })),
      save: jest.fn(async (value) => ({ updatedAt: new Date(), ...value })),
    };
    const submissions = { findOne: jest.fn().mockResolvedValue(null) };
    const service = new LogbooksService(
      logbooks as never,
      submissions as never,
      activitiesService as never,
    );

    const result = await service.update(student as never, 9, {
      initialIdeas: 'Idea',
      prompts: 'Prompt',
      validationsAndDecisions: 'Validación',
      finalReflection: 'Reflexión',
    });

    expect(activitiesService.getForStudent).toHaveBeenCalledWith(4, 9);
    expect(result.initialIdeas).toBe('Idea');
  });

  it('rechaza cambios en la bitacora cuando la entrega ya fue evaluada', async () => {
    const activitiesService = {
      getForStudent: jest.fn().mockResolvedValue({ id: 9, title: 'Actividad' }),
    };
    const logbooks = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    const submissions = {
      findOne: jest.fn().mockResolvedValue({ status: 'evaluated' }),
    };
    const service = new LogbooksService(
      logbooks as never,
      submissions as never,
      activitiesService as never,
    );

    await expect(
      service.update({ id: 4 } as never, 9, {
        initialIdeas: 'Intento de cambio',
        prompts: 'Prompt',
        validationsAndDecisions: 'Validacion',
        finalReflection: 'Reflexion',
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(logbooks.save).not.toHaveBeenCalled();
  });
});
