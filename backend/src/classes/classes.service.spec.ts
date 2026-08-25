import { UserRole } from '../entities/user.entity';
import { ClassesService } from './classes.service';

describe('ClassesService', () => {
  it('matricula únicamente una cuenta estudiantil activa en una clase del docente', async () => {
    const academicClass = { id: 10, teacher: { id: 3 } };
    const student = {
      id: 7,
      email: 'estudiante@unah.edu.hn',
      name: 'Estudiante',
      role: UserRole.STUDENT,
      active: true,
    };
    const classes = { findOne: jest.fn().mockResolvedValue(academicClass) };
    const enrollments = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => ({ id: 20, enrolledAt: new Date(), ...value })),
      save: jest.fn(async (value) => value),
    };
    const users = { findOne: jest.fn().mockResolvedValue(student) };
    const service = new ClassesService(classes as never, enrollments as never, users as never);

    const result = await service.enrollStudent(3, 10, ' ESTUDIANTE@UNAH.EDU.HN ');

    expect(users.findOne).toHaveBeenCalledWith({
      where: { email: 'estudiante@unah.edu.hn', role: UserRole.STUDENT, active: true },
    });
    expect(enrollments.save).toHaveBeenCalled();
    expect(result.student.email).toBe('estudiante@unah.edu.hn');
  });

  it('matricula estudiantes en lote, elimina duplicados y reporta cuentas no encontradas', async () => {
    const academicClass = { id: 10, teacher: { id: 3 } };
    const newStudent = {
      id: 7,
      email: 'nuevo@unah.edu.hn',
      name: 'Estudiante nuevo',
      role: UserRole.STUDENT,
      active: true,
    };
    const enrolledStudent = {
      id: 8,
      email: 'matriculado@unah.edu.hn',
      name: 'Estudiante matriculado',
      role: UserRole.STUDENT,
      active: true,
    };
    const existingEnrollment = {
      id: 21,
      student: enrolledStudent,
      academicClass,
      active: true,
      enrolledAt: new Date(),
    };
    const classes = { findOne: jest.fn().mockResolvedValue(academicClass) };
    const enrollments = {
      find: jest.fn().mockResolvedValue([existingEnrollment]),
      create: jest.fn((value) => ({ id: 22, enrolledAt: new Date(), active: true, ...value })),
      save: jest.fn(async (value) => value),
    };
    const users = { find: jest.fn().mockResolvedValue([newStudent, enrolledStudent]) };
    const service = new ClassesService(classes as never, enrollments as never, users as never);

    const result = await service.enrollStudents(3, 10, [
      ' NUEVO@UNAH.EDU.HN ',
      'nuevo@unah.edu.hn',
      'matriculado@unah.edu.hn',
      'no-existe@unah.edu.hn',
    ]);

    expect(result).toEqual({
      processedCount: 3,
      enrolledCount: 1,
      alreadyEnrolledCount: 1,
      notFoundEmails: ['no-existe@unah.edu.hn'],
    });
    expect(enrollments.create).toHaveBeenCalledTimes(1);
    expect(enrollments.save).toHaveBeenCalledWith([
      expect.objectContaining({ student: newStudent, academicClass, active: true }),
    ]);
  });

  it('reactiva una matrícula previa inactiva durante la importación masiva', async () => {
    const academicClass = { id: 10, teacher: { id: 3 } };
    const student = {
      id: 9,
      email: 'reactivado@unah.edu.hn',
      role: UserRole.STUDENT,
      active: true,
    };
    const inactiveEnrollment = {
      id: 23,
      student,
      academicClass,
      active: false,
      enrolledAt: new Date(),
    };
    const classes = { findOne: jest.fn().mockResolvedValue(academicClass) };
    const enrollments = {
      find: jest.fn().mockResolvedValue([inactiveEnrollment]),
      create: jest.fn(),
      save: jest.fn(async (value) => value),
    };
    const users = { find: jest.fn().mockResolvedValue([student]) };
    const service = new ClassesService(classes as never, enrollments as never, users as never);

    const result = await service.enrollStudents(3, 10, ['reactivado@unah.edu.hn']);

    expect(result.enrolledCount).toBe(1);
    expect(result.alreadyEnrolledCount).toBe(0);
    expect(inactiveEnrollment.active).toBe(true);
    expect(enrollments.save).toHaveBeenCalledWith([inactiveEnrollment]);
  });
});
