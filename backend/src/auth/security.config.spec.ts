import { ConfigService } from '@nestjs/config';
import { requiredJwtSecret, sessionCookieOptions } from './security.config';

describe('Configuración de seguridad', () => {
  function config(values: Record<string, string | undefined>) {
    return { get: jest.fn((key: string) => values[key]) } as unknown as ConfigService;
  }

  it('exige un JWT_SECRET robusto y sin valores de ejemplo', () => {
    expect(() => requiredJwtSecret(config({}))).toThrow('JWT_SECRET es obligatorio');
    expect(() => requiredJwtSecret(config({ JWT_SECRET: 'clave-corta' }))).toThrow(
      'JWT_SECRET es obligatorio',
    );
    expect(() =>
      requiredJwtSecret(config({ JWT_SECRET: 'cambie-esta-clave-en-produccion' })),
    ).toThrow('JWT_SECRET es obligatorio');
    expect(
      requiredJwtSecret(config({ JWT_SECRET: 'secreto-seguro-de-pruebas-con-mas-de-32-caracteres' })),
    ).toBe('secreto-seguro-de-pruebas-con-mas-de-32-caracteres');
  });

  it('marca la cookie como HttpOnly, SameSite Strict y Secure en producción', () => {
    expect(sessionCookieOptions(config({ NODE_ENV: 'production' }))).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/api',
    });
    expect(sessionCookieOptions(config({ NODE_ENV: 'development' })).secure).toBe(false);
  });
});
