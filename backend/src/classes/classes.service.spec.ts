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
});
