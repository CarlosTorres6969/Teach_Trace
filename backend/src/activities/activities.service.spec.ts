import { NotFoundException } from '@nestjs/common';
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
});
