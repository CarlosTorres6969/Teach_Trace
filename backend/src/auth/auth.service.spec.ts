import { UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserRole, UserTheme } from '../entities/user.entity';
import { LoginAttemptService } from './login-attempt.service';

describe('AuthService', () => {
  function createService(overrides: Partial<{
    users: any;
    sessions: any;
    jwt: any;
    loginAttempts: Partial<LoginAttemptService>;
  }> = {}) {
    const users = overrides.users ?? { findOne: jest.fn() };
    const sessions = overrides.sessions ?? {
      create: jest.fn((value) => ({ id: 'session-1', ...value })),
      save: jest.fn(async (value) => value),
    };
    const jwt = overrides.jwt ?? { signAsync: jest.fn(async () => 'token-firmado') };
    const loginAttempts = overrides.loginAttempts ?? {
      checkAttempts: jest.fn(() => ({ allowed: true })),
      recordFailure: jest.fn(),
      recordSuccess: jest.fn(),
    };
    return new AuthService(users as never, sessions as never, jwt as never, loginAttempts as never);
  }

  it('autentica una cuenta activa y crea una sesión', async () => {
    const loginAttempts = {
      checkAttempts: jest.fn(() => ({ allowed: true })),
      recordFailure: jest.fn(),
      recordSuccess: jest.fn(),
    };
    const service = createService({ loginAttempts });
    const passwordHash = await service.hashPassword('Estudiante123!');
    const usersMock = service['users'] as jest.Mocked<typeof service['users']>;
    usersMock.findOne.mockResolvedValue({
      id: 1,
      email: 'estudiante@unah.edu.hn',
      name: 'Estudiante',
      role: UserRole.STUDENT,
      theme: UserTheme.SYSTEM,
      accessibilitySettings: {
        fontSize: 100,
        highContrast: false,
        reducedMotion: false,
      },
      active: true,
      passwordHash,
      sessions: [],
    });

    const result = await service.login({
      email: 'ESTUDIANTE@UNAH.EDU.HN',
      password: 'Estudiante123!',
    }, '127.0.0.1');

    expect(result.accessToken).toBe('token-firmado');
    expect(result.user.role).toBe(UserRole.STUDENT);
    expect(service['sessions'].save).toHaveBeenCalled();
    expect(loginAttempts.recordSuccess).toHaveBeenCalledWith('estudiante@unah.edu.hn');
  });

  it('rechaza una contraseña incorrecta', async () => {
    const loginAttempts = {
      checkAttempts: jest.fn(() => ({ allowed: true })),
      recordFailure: jest.fn(),
      recordSuccess: jest.fn(),
    };
    const service = createService({ 
      users: { findOne: jest.fn().mockResolvedValue(null) },
      loginAttempts,
    });
    await expect(
      service.login({ email: 'estudiante@unah.edu.hn', password: 'Incorrecta123!' }, '127.0.0.1'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(loginAttempts.recordFailure).toHaveBeenCalledWith('estudiante@unah.edu.hn', expect.any(Number));
  });

  it('bloquea tras múltiples intentos fallidos (429)', async () => {
    const loginAttempts = {
      checkAttempts: jest.fn(() => ({ allowed: false, retryAfter: 60 })),
      recordFailure: jest.fn(),
      recordSuccess: jest.fn(),
    };
    const service = createService({ loginAttempts });
    
    await expect(
      service.login({ email: 'estudiante@unah.edu.hn', password: 'Incorrecta123!' }, '127.0.0.1'),
    ).rejects.toThrow(HttpException);
    
    try {
      await service.login({ email: 'estudiante@unah.edu.hn', password: 'Incorrecta123!' }, '127.0.0.1');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      expect((e as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect((e as HttpException).getResponse()).toEqual(
        expect.objectContaining({ retryAfterSeconds: 60 }),
      );
    }
  });
});
