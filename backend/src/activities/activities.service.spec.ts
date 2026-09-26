import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ActivityPhase } from '../entities/activity.entity';
import { ActivitiesService } from './activities.service';

describe('ActivitiesService', () => {
  it('lista únicamente actividades de matrículas activas', async () => {
    const enrollments = {
      find: jest.fn().mockResolvedValue([{ academicClass: { id: 5 } }]),
    };
    const activities = {
      find: jest.fn().mockResolvedValue([{ id: 8, academicClass: { id: 5 } }]),
    };
    const service = new ActivitiesService(activities as never, enrollments as never, {} as never);

    const result = await service.listForStudent(3);

    expect(enrollments.find).toHaveBeenCalledWith({
      where: { student: { id: 3 }, active: true },
    });
    expect(result).toHaveLength(1);
  });

  it('rechaza una actividad cuando el estudiante no está matriculado', async () => {
    const activities = {
      findOne: jest.fn().mockResolvedValue({ id: 8, academicClass: { id: 5 } }),
    };
    const classesService = { isStudentEnrolled: jest.fn().mockResolvedValue(false) };
    const service = new ActivitiesService(activities as never, {} as never, classesService as never);

    await expect(service.getForStudent(3, 8)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('crea la actividad dentro de una clase propia y conserva su fase', async () => {
    const academicClass = { id: 5, subject: 'Ingeniería del Software' };
    const activities = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 8, ...value })),
    };
    const classesService = { ownedClass: jest.fn().mockResolvedValue(academicClass) };
    const service = new ActivitiesService(activities as never, {} as never, classesService as never);

    const result = await service.create({ id: 2 } as never, {
      title: 'Actividad piloto',
      classId: 5,
      dueDate: '2026-09-15',
      activityType: 'Ensayo',
      evaluationPhase: ActivityPhase.PILOT,
    });

    expect(result.evaluationPhase).toBe(ActivityPhase.PILOT);
    expect(result.academicClass).toBe(academicClass);
    expect(result.manualEvaluationRequired).toBe(false);
  });

  it('asocia, normaliza y persiste resultados de aprendizaje en una actividad propia', async () => {
    const activity = { id: 8, learningOutcomes: [] as string[] };
    const activities = {
      findOne: jest.fn().mockResolvedValue(activity),
      save: jest.fn(async (value) => value),
    };
    const service = new ActivitiesService(activities as never, {} as never, {} as never);

    const result = await service.updateLearningOutcomes(2, 8, {
      learningOutcomes: ['  Analiza evidencia académica  ', 'Argumenta sus decisiones'],
    });

    expect(activities.findOne).toHaveBeenCalledWith({
      where: { id: 8, teacher: { id: 2 } },
      relations: undefined,
    });
    expect(result.learningOutcomes).toEqual([
      'Analiza evidencia académica',
      'Argumenta sus decisiones',
    ]);
    expect(activities.save).toHaveBeenCalledWith(activity);
  });

  it('rechaza resultados vacíos después de normalizarlos', async () => {
    const activities = {
      findOne: jest.fn().mockResolvedValue({ id: 8, learningOutcomes: [] }),
      save: jest.fn(),
    };
    const service = new ActivitiesService(activities as never, {} as never, {} as never);

    await expect(
      service.updateLearningOutcomes(2, 8, { learningOutcomes: ['   '] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(activities.save).not.toHaveBeenCalled();
  });

  it('elimina una actividad propia sin trabajo estudiantil', async () => {
    const activity = { id: 8, title: 'Actividad creada por error' };
    const notificationRepository = { delete: jest.fn().mockResolvedValue({ affected: 0 }) };
    const activityRepository = { delete: jest.fn().mockResolvedValue({ affected: 1 }) };
    const transactionManager = {
      getRepository: jest.fn((entity: { name: string }) =>
        entity.name === 'Notification' ? notificationRepository : activityRepository,
      ),
    };
    const manager = {
      getRepository: jest.fn(() => ({ exist: jest.fn().mockResolvedValue(false) })),
      transaction: jest.fn(async (work) => work(transactionManager)),
    };
    const activities = {
      findOne: jest.fn().mockResolvedValue(activity),
      manager,
    };
    const service = new ActivitiesService(activities as never, {} as never, {} as never);

    await expect(service.remove(2, 8)).resolves.toEqual({ id: 8, deleted: true });
    expect(notificationRepository.delete).toHaveBeenCalledWith({ activityId: 8 });
    expect(activityRepository.delete).toHaveBeenCalledWith(8);
  });

  it('protege una actividad que ya contiene avances o entregas', async () => {
    const transaction = jest.fn();
    const activities = {
      findOne: jest.fn().mockResolvedValue({ id: 8 }),
      manager: {
        getRepository: jest.fn((entity: { name: string }) => ({
          exist: jest.fn().mockResolvedValue(entity.name === 'Logbook'),
        })),
        transaction,
      },
    };
    const service = new ActivitiesService(activities as never, {} as never, {} as never);

    await expect(service.remove(2, 8)).rejects.toBeInstanceOf(ConflictException);
    expect(transaction).not.toHaveBeenCalled();
  });
});
