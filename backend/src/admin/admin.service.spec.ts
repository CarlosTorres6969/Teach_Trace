import { ConflictException } from '@nestjs/common';
import { UserRole } from '../entities/user.entity';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  function setup(existing: Record<string, unknown> | null = null) {
    const users = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(existing),
      create: jest.fn((value) => ({ id: 8, ...value })),
      save: jest.fn(async (value) => value),
    };
    const authService = { hashPassword: jest.fn().mockResolvedValue('hash-temporal') };
    const mailService = { sendTeacherInvitationEmail: jest.fn().mockResolvedValue(true) };
    return {
      users,
      authService,
      mailService,
      service: new AdminService(users as never, authService as never, mailService as never),
    };
  }

  it('crea el docente con contraseña temporal y envía la invitación sin exponerla', async () => {
    const { service, users, authService, mailService } = setup();

    const result = await service.createTeacher({
      name: '  Ana Docente  ',
      email: ' ANA.DOCENTE@UNAH.EDU.HN ',
    });

    expect(users.create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Ana Docente',
      email: 'ana.docente@unah.edu.hn',
      role: UserRole.TEACHER,
      active: true,
      mustChangePassword: true,
      passwordHash: 'hash-temporal',
    }));
    expect(authService.hashPassword).toHaveBeenCalledWith(expect.stringMatching(/^Tt!/));
    expect(mailService.sendTeacherInvitationEmail).toHaveBeenCalledWith(
      'ana.docente@unah.edu.hn',
      'Ana Docente',
      expect.stringMatching(/^Tt!/),
    );
    expect(result).toMatchObject({
      id: 8,
      name: 'Ana Docente',
      email: 'ana.docente@unah.edu.hn',
      active: true,
      mustChangePassword: true,
      invitationEmailSent: true,
    });
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('temporaryPassword');
  });

  it('rechaza correos que ya pertenecen a cualquier cuenta', async () => {
    const { service, users, mailService } = setup({ id: 3, role: UserRole.STUDENT });

    await expect(service.createTeacher({
      name: 'Docente duplicado',
      email: 'existente@unah.edu.hn',
    })).rejects.toBeInstanceOf(ConflictException);

    expect(users.save).not.toHaveBeenCalled();
    expect(mailService.sendTeacherInvitationEmail).not.toHaveBeenCalled();
  });

  it('lista solamente las cuentas docentes sin información sensible', async () => {
    const { service, users } = setup();
    users.find.mockResolvedValue([{
      id: 4,
      name: 'Docente',
      email: 'docente@unah.edu.hn',
      passwordHash: 'secreto',
      role: UserRole.TEACHER,
      active: true,
      mustChangePassword: false,
    }]);

    const result = await service.listTeachers();

    expect(users.find).toHaveBeenCalledWith({
      where: { role: UserRole.TEACHER },
      order: { name: 'ASC', email: 'ASC' },
    });
    expect(result).toEqual([{
      id: 4,
      name: 'Docente',
      email: 'docente@unah.edu.hn',
      active: true,
      mustChangePassword: false,
    }]);
  });
});
