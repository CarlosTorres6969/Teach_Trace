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
    const service = new LogbooksService(logbooks as never, activitiesService as never);

    const result = await service.update(student as never, 9, {
      initialIdeas: 'Idea',
      prompts: 'Prompt',
      validationsAndDecisions: 'Validación',
      finalReflection: 'Reflexión',
    });

    expect(activitiesService.getForStudent).toHaveBeenCalledWith(4, 9);
    expect(result.initialIdeas).toBe('Idea');
  });
});
