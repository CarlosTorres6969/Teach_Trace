import { UserRole } from '../entities/user.entity';
import { ClassesService } from './classes.service';

describe('ClassesService', () => {
  it('crea una cuenta estudiantil con contraseña temporal y envía la invitación', async () => {
    const academicClass = {
      id: 10,
      name: 'Ingeniería del Software',
      subject: 'IS',
      code: 'IS-911',
      period: 'III PAC 2026',
      teacher: { id: 3 },
    };
    const classes = { findOne: jest.fn().mockResolvedValue(academicClass) };
    const enrollments = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => ({ id: 20, enrolledAt: new Date(), ...value })),
      save: jest.fn(async (value) => value),
    };
    const users = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => ({ id: 7, ...value })),
      save: jest.fn(async (value) => value),
    };
    const authService = { hashPassword: jest.fn().mockResolvedValue('hash-temporal') };
    const mailService = { sendTemporaryPasswordEmail: jest.fn().mockResolvedValue(true) };
    const service = new ClassesService(
      classes as never,
      enrollments as never,
      users as never,
      authService as never,
      mailService as never,
    );

    const result = await service.enrollStudent(
      3,
      10,
      ' NUEVO@UNAH.HN ',
      'Nuevo Estudiante',
    );

    expect(users.create).toHaveBeenCalledWith(expect.objectContaining({
      email: 'nuevo@unah.hn',
      name: 'Nuevo Estudiante',
      role: UserRole.STUDENT,
      active: true,
      mustChangePassword: true,
      passwordHash: 'hash-temporal',
    }));
    expect(mailService.sendTemporaryPasswordEmail).toHaveBeenCalledWith(
      'nuevo@unah.hn',
      'Nuevo Estudiante',
      expect.stringMatching(/^Tt!/),
      {
        name: 'Ingeniería del Software',
        subject: 'IS',
        code: 'IS-911',
        period: 'III PAC 2026',
      },
    );
    expect(result).toMatchObject({
      accountCreated: true,
      invitationEmailSent: true,
      student: { email: 'nuevo@unah.hn' },
    });
    expect(result).not.toHaveProperty('temporaryPassword');
  });

  it('matricula únicamente una cuenta estudiantil activa en una clase del docente', async () => {
    const academicClass = {
      id: 10,
      name: 'Ingeniería del Software',
      subject: 'IS',
      code: 'IS-911',
      period: 'III PAC 2026',
      teacher: { id: 3 },
    };
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
    const authService = { hashPassword: jest.fn() };
    const mailService = {
      sendTemporaryPasswordEmail: jest.fn(),
      sendEnrollmentEmail: jest.fn().mockResolvedValue(true),
    };
    const service = new ClassesService(
      classes as never,
      enrollments as never,
      users as never,
      authService as never,
      mailService as never,
    );

    const result = await service.enrollStudent(3, 10, ' ESTUDIANTE@UNAH.EDU.HN ');

    expect(users.findOne).toHaveBeenCalledWith({
      where: { email: 'estudiante@unah.edu.hn' },
    });
    expect(enrollments.save).toHaveBeenCalled();
    expect(result.student.email).toBe('estudiante@unah.edu.hn');
    expect(result.enrollmentEmailSent).toBe(true);
    expect(mailService.sendEnrollmentEmail).toHaveBeenCalledWith(
      'estudiante@unah.edu.hn',
      'Estudiante',
      {
        name: 'Ingeniería del Software',
        subject: 'IS',
        code: 'IS-911',
        period: 'III PAC 2026',
      },
    );
  });

  it('no duplica el correo si el estudiante ya estaba matriculado activamente', async () => {
    const academicClass = { id: 10, teacher: { id: 3 } };
    const student = {
      id: 7,
      email: 'estudiante@unah.edu.hn',
      name: 'Estudiante',
      role: UserRole.STUDENT,
      active: true,
    };
    const activeEnrollment = {
      id: 20,
      student,
      academicClass,
      active: true,
      enrolledAt: new Date(),
    };
    const classes = { findOne: jest.fn().mockResolvedValue(academicClass) };
    const enrollments = {
      findOne: jest.fn().mockResolvedValue(activeEnrollment),
      create: jest.fn(),
      save: jest.fn(async (value) => value),
    };
    const users = { findOne: jest.fn().mockResolvedValue(student) };
    const mailService = {
      sendTemporaryPasswordEmail: jest.fn(),
      sendEnrollmentEmail: jest.fn(),
    };
    const service = new ClassesService(
      classes as never,
      enrollments as never,
      users as never,
      { hashPassword: jest.fn() } as never,
      mailService as never,
    );

    const result = await service.enrollStudent(3, 10, student.email);

    expect(result.enrollmentEmailSent).toBeNull();
    expect(mailService.sendEnrollmentEmail).not.toHaveBeenCalled();
  });

  it('matricula estudiantes en lote, elimina duplicados y reporta cuentas no encontradas', async () => {
    const academicClass = {
      id: 10,
      name: 'Ingeniería del Software',
      subject: 'IS',
      code: 'IS-911',
      period: 'III PAC 2026',
      teacher: { id: 3 },
    };
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
    const authService = { hashPassword: jest.fn() };
    const mailService = {
      sendTemporaryPasswordEmail: jest.fn(),
      sendEnrollmentEmail: jest.fn().mockResolvedValue(true),
    };
    const service = new ClassesService(
      classes as never,
      enrollments as never,
      users as never,
      authService as never,
      mailService as never,
    );

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
    expect(mailService.sendEnrollmentEmail).toHaveBeenCalledTimes(1);
    expect(mailService.sendEnrollmentEmail).toHaveBeenCalledWith(
      newStudent.email,
      newStudent.name,
      expect.objectContaining({ code: 'IS-911' }),
    );
  });

  it('reactiva una matrícula previa inactiva durante la importación masiva', async () => {
    const academicClass = {
      id: 10,
      name: 'Ingeniería del Software',
      subject: 'IS',
      code: 'IS-911',
      period: 'III PAC 2026',
      teacher: { id: 3 },
    };
    const student = {
      id: 9,
      email: 'reactivado@unah.edu.hn',
      name: 'Estudiante reactivado',
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
    const authService = { hashPassword: jest.fn() };
    const mailService = {
      sendTemporaryPasswordEmail: jest.fn(),
      sendEnrollmentEmail: jest.fn().mockResolvedValue(true),
    };
    const service = new ClassesService(
      classes as never,
      enrollments as never,
      users as never,
      authService as never,
      mailService as never,
    );

    const result = await service.enrollStudents(3, 10, ['reactivado@unah.edu.hn']);

    expect(result.enrolledCount).toBe(1);
    expect(result.alreadyEnrolledCount).toBe(0);
    expect(inactiveEnrollment.active).toBe(true);
    expect(enrollments.save).toHaveBeenCalledWith([inactiveEnrollment]);
    expect(mailService.sendEnrollmentEmail).toHaveBeenCalledWith(
      student.email,
      student.name,
      expect.objectContaining({ code: 'IS-911' }),
    );
  });
});
