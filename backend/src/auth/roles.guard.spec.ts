import { ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { UserRole } from '../entities/user.entity';

describe('RolesGuard', () => {
  function context(role: UserRole, activeRole?: UserRole) {
    return {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ user: { role, activeRole } }) }),
    } as never;
  }

  it('permite el rol solicitado', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue([UserRole.STUDENT]) };
    expect(new RolesGuard(reflector as never).canActivate(context(UserRole.STUDENT))).toBe(true);
  });

  it('autoriza según el modo activo y no según el rol principal', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue([UserRole.TEACHER]) };
    expect(
      new RolesGuard(reflector as never).canActivate(
        context(UserRole.ADMIN, UserRole.TEACHER),
      ),
    ).toBe(true);
  });

  it('rechaza funciones de otro rol', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue([UserRole.TEACHER]) };
    expect(() => new RolesGuard(reflector as never).canActivate(context(UserRole.STUDENT))).toThrow(
      ForbiddenException,
    );
  });
});
