import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const config = { get: jest.fn(() => 'test') } as unknown as ConfigService;

  function context(request: Record<string, unknown>) {
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as never;
  }

  function request() {
    return {
      headers: { cookie: 'teachtrace_session=token-firmado' },
      res: { clearCookie: jest.fn() },
    };
  }

  it('acepta la cookie de una sesión activa', async () => {
    const currentRequest = request();
    const user = { id: 4, active: true };
    const session = {
      id: 'session-1',
      user,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60000),
    };
    const jwt = { verifyAsync: jest.fn().mockResolvedValue({ sub: 4, sid: 'session-1' }) };
    const sessions = { findOne: jest.fn().mockResolvedValue(session) };
    const guard = new JwtAuthGuard(jwt as never, sessions as never, config);

    await expect(guard.canActivate(context(currentRequest))).resolves.toBe(true);
    expect(currentRequest).toMatchObject({ user, session });
  });

  it('rechaza y limpia la cookie de una sesión expirada', async () => {
    const currentRequest = request();
    const jwt = { verifyAsync: jest.fn().mockResolvedValue({ sub: 4, sid: 'session-1' }) };
    const sessions = {
      findOne: jest.fn().mockResolvedValue({
        id: 'session-1',
        user: { id: 4, active: true },
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      }),
    };
    const guard = new JwtAuthGuard(jwt as never, sessions as never, config);

    await expect(guard.canActivate(context(currentRequest))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(currentRequest.res.clearCookie).toHaveBeenCalled();
  });

  it('rechaza la sesión si el docente fue desactivado', async () => {
    const currentRequest = request();
    const jwt = { verifyAsync: jest.fn().mockResolvedValue({ sub: 4, sid: 'session-1' }) };
    const sessions = {
      findOne: jest.fn().mockResolvedValue({
        id: 'session-1',
        user: { id: 4, active: false },
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60000),
      }),
    };
    const guard = new JwtAuthGuard(jwt as never, sessions as never, config);

    await expect(guard.canActivate(context(currentRequest))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(currentRequest.res.clearCookie).toHaveBeenCalled();
  });
});
