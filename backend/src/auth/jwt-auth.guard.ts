import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { AuthSession } from '../entities/auth-session.entity';

type AccessTokenPayload = { sub: number; sid: string; role: string };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(AuthSession)
    private readonly sessions: Repository<AuthSession>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: unknown; session?: AuthSession }>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Sesión no válida');

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
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Sesión no válida');
    }
  }
}
