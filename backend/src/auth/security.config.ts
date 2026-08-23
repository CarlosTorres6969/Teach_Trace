import { ConfigService } from '@nestjs/config';
import type { CookieOptions } from 'express';

export const SESSION_COOKIE_NAME = 'teachtrace_session';

const INSECURE_JWT_SECRETS = new Set([
  'solo-desarrollo-cambie-esta-clave',
  'cambie-esta-clave-en-produccion',
  'reemplace-con-un-secreto-aleatorio-de-64-caracteres',
]);

export function requiredJwtSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET')?.trim();
  if (!secret || secret.length < 32 || INSECURE_JWT_SECRETS.has(secret.toLowerCase())) {
    throw new Error(
      'JWT_SECRET es obligatorio, debe tener al menos 32 caracteres y no puede usar una clave de ejemplo.',
    );
  }
  return secret;
}

export function sessionCookieOptions(config: ConfigService): CookieOptions {
  return {
    httpOnly: true,
    secure: config.get<string>('NODE_ENV') === 'production',
    sameSite: 'strict',
    path: '/api',
  };
}
