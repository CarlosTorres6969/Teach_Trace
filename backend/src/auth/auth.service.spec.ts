import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserRole } from '../entities/user.entity';

describe('AuthService', () => {
  it('autentica una cuenta activa y crea una sesión', async () => {
    const users = { findOne: jest.fn() };
    const sessions = {
      create: jest.fn((value) => ({ id: 'session-1', ...value })),
      save: jest.fn(async (value) => value),
    };
    const jwt = { signAsync: jest.fn(async () => 'token-firmado') };
    const service = new AuthService(users as never, sessions as never, jwt as never);
    const passwordHash = await service.hashPassword('Estudiante123!');
    users.findOne.mockResolvedValue({
      id: 1,
      email: 'estudiante@unah.edu.hn',
      name: 'Estudiante',
      role: UserRole.STUDENT,
      active: true,
      passwordHash,
    });

    const result = await service.login({
      email: 'ESTUDIANTE@UNAH.EDU.HN',
      password: 'Estudiante123!',
    });

    expect(result.accessToken).toBe('token-firmado');
    expect(result.user.role).toBe(UserRole.STUDENT);
    expect(sessions.save).toHaveBeenCalled();
  });

  it('rechaza una contraseña incorrecta', async () => {
    const users = { findOne: jest.fn().mockResolvedValue(null) };
    const service = new AuthService(users as never, {} as never, {} as never);
    await expect(
      service.login({ email: 'estudiante@unah.edu.hn', password: 'Incorrecta123!' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
