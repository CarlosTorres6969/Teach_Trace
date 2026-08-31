import { ConflictException, NotFoundException } from '@nestjs/common';
import { RubricsService } from './rubrics.service';

describe('RubricsService', () => {
  const activity = { id: 10, rubric: null };

  it('normaliza todos los textos antes de persistir una rúbrica', async () => {
    const rubrics = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    const service = new RubricsService(rubrics as never, {} as never, {} as never);
    const teacher = { id: 3 };

    await service.create(teacher as never, {
      name: '  Rúbrica normalizada  ',
      criteria: [
        {
          name: '  Argumentación  ',
          dimension: '  Calidad argumentativa  ',
          descriptors: {
            level1: '  Inicial  ',
            level2: '  Básico  ',
            level3: '  Competente  ',
            level4: '  Avanzado  ',
          },
        },
      ],
    });

    expect(rubrics.create).toHaveBeenCalledWith({
      name: 'Rúbrica normalizada',
      criteria: [
        {
          name: 'Argumentación',
          dimension: 'Calidad argumentativa',
          descriptors: {
            level1: 'Inicial',
            level2: 'Básico',
            level3: 'Competente',
            level4: 'Avanzado',
          },
        },
      ],
      teacher,
      activity: null,
    });
    expect(rubrics.save).toHaveBeenCalled();
  });

  it('asocia y persiste una rúbrica disponible', async () => {
    const rubric = { id: 20, activity: null };
    const associatedActivity = { ...activity, rubric };
    const rubrics = {
      findOne: jest.fn().mockResolvedValueOnce(rubric).mockResolvedValueOnce(null),
      save: jest.fn(async (value) => value),
    };
    const activitiesService = {
      ownedActivity: jest
        .fn()
        .mockResolvedValueOnce(activity)
        .mockResolvedValueOnce(associatedActivity),
    };
    const service = new RubricsService(rubrics as never, {} as never, activitiesService as never);

    const result = await service.associate(3, 10, { rubricId: 20 });

    expect(rubric.activity).toBe(activity);
    expect(rubrics.save).toHaveBeenCalledWith([rubric]);
    expect(activitiesService.ownedActivity).toHaveBeenLastCalledWith(3, 10, true);
    expect(result).toBe(associatedActivity);
  });

  it('sustituye la rúbrica y libera la asociación anterior', async () => {
    const previousRubric = { id: 19, activity };
    const replacement = { id: 20, activity: null };
    const rubrics = {
      findOne: jest.fn().mockResolvedValueOnce(replacement).mockResolvedValueOnce(previousRubric),
      save: jest.fn(async (value) => value),
    };
    const activitiesService = {
      ownedActivity: jest.fn().mockResolvedValueOnce(activity).mockResolvedValueOnce({
        ...activity,
        rubric: replacement,
      }),
    };
    const service = new RubricsService(rubrics as never, {} as never, activitiesService as never);

    await service.associate(3, 10, { rubricId: 20 });

    expect(previousRubric.activity).toBeNull();
    expect(replacement.activity).toBe(activity);
    expect(rubrics.save).toHaveBeenCalledWith([previousRubric, replacement]);
  });

  it('trata como idempotente asociar nuevamente la misma rúbrica', async () => {
    const rubric = { id: 20, activity };
    const rubrics = { findOne: jest.fn().mockResolvedValue(rubric), save: jest.fn() };
    const associatedActivity = { ...activity, rubric };
    const activitiesService = {
      ownedActivity: jest
        .fn()
        .mockResolvedValueOnce(activity)
        .mockResolvedValueOnce(associatedActivity),
    };
    const service = new RubricsService(rubrics as never, {} as never, activitiesService as never);

    await expect(service.associate(3, 10, { rubricId: 20 })).resolves.toBe(associatedActivity);
    expect(rubrics.save).not.toHaveBeenCalled();
  });

  it('rechaza reutilizar una rúbrica asociada a otra actividad', async () => {
    const rubric = { id: 20, activity: { id: 11 } };
    const rubrics = { findOne: jest.fn().mockResolvedValue(rubric), save: jest.fn() };
    const activitiesService = { ownedActivity: jest.fn().mockResolvedValue(activity) };
    const service = new RubricsService(rubrics as never, {} as never, activitiesService as never);

    await expect(service.associate(3, 10, { rubricId: 20 })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(rubrics.save).not.toHaveBeenCalled();
  });

  it('rechaza una actividad o rúbrica que no pertenece al docente', async () => {
    const ownershipError = new NotFoundException();
    const rubrics = { findOne: jest.fn(), save: jest.fn() };
    const deniedActivities = { ownedActivity: jest.fn().mockRejectedValue(ownershipError) };
    const deniedService = new RubricsService(
      rubrics as never,
      {} as never,
      deniedActivities as never,
    );
    await expect(deniedService.associate(3, 10, { rubricId: 20 })).rejects.toBe(ownershipError);
    expect(rubrics.findOne).not.toHaveBeenCalled();

    const missingRubricService = new RubricsService(
      { findOne: jest.fn().mockResolvedValue(null) } as never,
      {} as never,
      { ownedActivity: jest.fn().mockResolvedValue(activity) } as never,
    );
    await expect(missingRubricService.associate(3, 10, { rubricId: 20 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
