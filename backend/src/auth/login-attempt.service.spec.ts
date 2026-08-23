import { ConfigService } from '@nestjs/config';
import { LoginAttemptService } from './login-attempt.service';

describe('LoginAttemptService', () => {
  function service() {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'LOGIN_MAX_ATTEMPTS') return '3';
        if (key === 'LOGIN_WINDOW_MS') return '60000';
        return undefined;
      }),
    } as unknown as ConfigService;
    return new LoginAttemptService(config);
  }

  it('bloquea temporalmente una cuenta después del máximo de fallos', () => {
    const attempts = service();
    attempts.recordFailure(' DOCENTE@UNAH.EDU.HN ', 1000);
    attempts.recordFailure('docente@unah.edu.hn', 1000);
    expect(attempts.retryAfterSeconds('docente@unah.edu.hn', 1000)).toBe(0);
    attempts.recordFailure('docente@unah.edu.hn', 1000);
    expect(attempts.retryAfterSeconds('docente@unah.edu.hn', 1000)).toBe(60);
  });

  it('libera el bloqueo al vencer la ventana o iniciar sesión correctamente', () => {
    const attempts = service();
    for (let index = 0; index < 3; index += 1) {
      attempts.recordFailure('docente@unah.edu.hn', 1000);
    }
    expect(attempts.retryAfterSeconds('docente@unah.edu.hn', 61000)).toBe(0);

    attempts.recordFailure('docente@unah.edu.hn', 70000);
    attempts.reset('docente@unah.edu.hn');
    expect(attempts.retryAfterSeconds('docente@unah.edu.hn', 70000)).toBe(0);
  });
});
