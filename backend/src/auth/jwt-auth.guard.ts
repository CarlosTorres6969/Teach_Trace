import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { AuthSession } from '../entities/auth-session.entity';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from './security.config';

type AccessTokenPayload = { sub: number; sid: string; role: string };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(AuthSession)
    private readonly sessions: Repository<AuthSession>,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: unknown; session?: AuthSession }>();
    const token = this.accessToken(request);
    if (!token) {
      this.clearSessionCookie(request);
      throw new UnauthorizedException('Sesión no válida');
    }

    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token);
      const session = await this.sessions.findOne({ where: { id: payload.sid } });
      if (
        !session ||
        session.revokedAt ||
        session.expiresAt.getTime() <= Date.now() ||
        !session.user.active ||
        session.user.id !== payload.sub
      ) {
        throw new UnauthorizedException('La sesión expiró o fue cerrada');
      }
      request.user = session.user;
      request.session = session;
      if (session.user.mustChangePassword && !this.isTemporaryPasswordRoute(request.path)) {
        throw new ForbiddenException('Debes cambiar la contraseña temporal antes de continuar');
      }
      return true;
    } catch (error) {
      this.clearSessionCookie(request);
      if (error instanceof UnauthorizedException || error instanceof ForbiddenException) throw error;
      throw new UnauthorizedException('Sesión no válida');
    }
  }

  private isTemporaryPasswordRoute(path: string): boolean {
    return [
      '/api/auth/me',
      '/api/auth/logout',
      '/api/auth/temporary-password/change',
    ].includes(path);
  }

  private accessToken(request: Request): string | undefined {
    const [scheme, bearerToken] = request.headers.authorization?.split(' ') ?? [];
    if (scheme === 'Bearer' && bearerToken) return bearerToken;

    const cookie = request.headers.cookie
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`));
    if (!cookie) return undefined;
    const value = cookie.slice(SESSION_COOKIE_NAME.length + 1);
    try {
      return decodeURIComponent(value);
    } catch {
      return undefined;
    }
  }

  private clearSessionCookie(request: Request) {
    request.res?.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions(this.config));
  }
}
