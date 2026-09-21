import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, Optional, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { IsNull, Repository } from 'typeorm';
import { AuthSession } from '../entities/auth-session.entity';
import { PasswordResetToken } from '../entities/password-reset-token.entity';
import { DEFAULT_ACCESSIBILITY_SETTINGS, User } from '../entities/user.entity';
import { MailService } from '../mail/mail.service';
import { LoginDto } from './login.dto';
import { LoginAttemptService } from './login-attempt.service';
import { ConfirmPasswordResetDto, RequestPasswordResetDto } from './password-reset.dto';
import { ChangeTemporaryPasswordDto } from './change-temporary-password.dto';

const scrypt = promisify(nodeScrypt);
const SESSION_HOURS = 8;
const RESET_TTL_MS = 30 * 60 * 1000;
const RESET_REQUEST_COOLDOWN_MS = 60 * 1000;
const RESET_REQUEST_MESSAGE = 'Si el correo está registrado, recibirás un enlace para recuperar tu contraseña.';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(AuthSession) private readonly sessions: Repository<AuthSession>,
    private readonly jwtService: JwtService,
    private readonly loginAttempts: LoginAttemptService,
    @Optional() private readonly config?: ConfigService,
    @Optional() @InjectRepository(PasswordResetToken) private readonly resetTokens?: Repository<PasswordResetToken>,
    @Optional() private readonly mailService?: MailService,
  ) {}

  async login(input: LoginDto, ip: string) {
    const email = input.email.trim().toLowerCase();
    const timestamp = Date.now();
    
    const attemptCheck = this.loginAttempts.checkAttempts(email, timestamp);
    if (!attemptCheck.allowed) {
      throw new HttpException(
        { message: 'Demasiados intentos fallidos. Intente más tarde.', retryAfterSeconds: attemptCheck.retryAfter },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.users.findOne({ where: { email, active: true } });
    if (!user || !(await this.verifyPassword(input.password, user.passwordHash))) {
      this.loginAttempts.recordFailure(email, timestamp);
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }

    this.loginAttempts.recordSuccess(email);

    const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
    const session = await this.sessions.save(this.sessions.create({ user, expiresAt, revokedAt: null }));
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      sid: session.id,
      role: user.role,
    });
    return { accessToken, expiresAt, user: this.safeUser(user) };
  }

  async logout(session: AuthSession) {
    session.revokedAt = new Date();
    await this.sessions.save(session);
    return { message: 'Sesión cerrada correctamente' };
  }

  async requestPasswordReset(input: RequestPasswordResetDto, ip: string) {
    const email = input.email.trim().toLowerCase();
    const user = await this.users.findOne({ where: { email, active: true } });

    if (user && this.resetTokens && this.mailService) {
      const latest = await this.resetTokens.findOne({
        where: { user: { id: user.id } },
        order: { createdAt: 'DESC' },
      });
      const recentlyRequested = latest && Date.now() - latest.createdAt.getTime() < RESET_REQUEST_COOLDOWN_MS;

      if (!recentlyRequested) {
        const rawToken = randomBytes(32).toString('hex');
        const createdAt = new Date();
        const previousTokens = await this.resetTokens.find({
          where: { user: { id: user.id }, usedAt: IsNull() },
        });
        previousTokens.forEach((previousToken) => { previousToken.usedAt = createdAt; });
        if (previousTokens.length) await this.resetTokens.save(previousTokens);
        const token = this.resetTokens.create({
          user,
          tokenHash: this.hashResetToken(rawToken),
          expiresAt: new Date(createdAt.getTime() + this.resetTtlMs()),
          usedAt: null,
          createdAt,
          requestIp: ip,
        });

        await this.resetTokens.save(token);
        const publicAppUrl = (this.config?.get<string>('PUBLIC_APP_URL') ?? 'http://localhost:5173').replace(/\/$/, '');
        const resetUrl = `${publicAppUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;

        const delivered = await this.deliverPasswordResetEmail(user.email, resetUrl);
        if (!delivered && this.config?.get<string>('NODE_ENV', 'development') !== 'production') {
          return { message: RESET_REQUEST_MESSAGE, resetUrl };
        }
      }
    }

    return { message: RESET_REQUEST_MESSAGE };
  }

  private async deliverPasswordResetEmail(email: string, resetUrl: string): Promise<boolean> {
    try {
      return await this.mailService?.sendPasswordResetEmail(email, resetUrl) ?? false;
    } catch (error) {
      this.logger.error('No fue posible enviar el correo de recuperación', error instanceof Error ? error.stack : undefined);
      if (this.config?.get<string>('NODE_ENV', 'development') !== 'production') {
        this.logger.warn(`Enlace de recuperaciÃ³n disponible para pruebas: ${resetUrl}`);
      }
      // Conservamos el token: un fallo temporal de SMTP no debe invalidar la recuperaciÃ³n.
      return false;
    }
  }

  async confirmPasswordReset(input: ConfirmPasswordResetDto) {
    if (!this.resetTokens) throw new BadRequestException('El servicio de recuperación no está disponible');

    const token = await this.resetTokens.findOne({
      where: { tokenHash: this.hashResetToken(input.token) },
    });
    const now = new Date();
    if (!token || token.usedAt || token.expiresAt.getTime() <= now.getTime() || !token.user?.active) {
      throw new BadRequestException('El enlace de recuperación no es válido o ya expiró');
    }

    token.user.passwordHash = await this.hashPassword(input.password);
    token.user.mustChangePassword = false;
    token.usedAt = now;
    await this.users.save(token.user);
    await this.resetTokens.save(token);

    const activeSessions = await this.sessions.find({
      where: { user: { id: token.user.id }, revokedAt: IsNull() },
    });
    if (activeSessions.length) {
      const revokedAt = new Date();
      activeSessions.forEach((session) => { session.revokedAt = revokedAt; });
      await this.sessions.save(activeSessions);
    }

    return { message: 'Contraseña actualizada. Inicia sesión con tu nueva contraseña.' };
  }

  async changeTemporaryPassword(
    user: User,
    currentSession: AuthSession,
    input: ChangeTemporaryPasswordDto,
  ) {
    if (!user.mustChangePassword) {
      throw new BadRequestException('La cuenta no tiene una contraseña temporal pendiente');
    }
    if (!(await this.verifyPassword(input.currentPassword, user.passwordHash))) {
      throw new BadRequestException('La contraseña temporal es incorrecta');
    }
    if (input.currentPassword === input.newPassword) {
      throw new BadRequestException('La nueva contraseña debe ser diferente de la temporal');
    }

    user.passwordHash = await this.hashPassword(input.newPassword);
    user.mustChangePassword = false;
    await this.users.save(user);

    const otherSessions = await this.sessions.find({
      where: { user: { id: user.id }, revokedAt: IsNull() },
    });
    const revokedAt = new Date();
    const sessionsToRevoke = otherSessions.filter((session) => session.id !== currentSession.id);
    sessionsToRevoke.forEach((session) => { session.revokedAt = revokedAt; });
    if (sessionsToRevoke.length) await this.sessions.save(sessionsToRevoke);

    return {
      message: 'Contraseña actualizada correctamente',
      user: this.safeUser(user),
    };
  }

  safeUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      mustChangePassword: user.mustChangePassword ?? false,
      theme: user.theme,
      accessibilitySettings: user.accessibilitySettings ?? {
        ...DEFAULT_ACCESSIBILITY_SETTINGS,
      },
    };
  }

  async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derived = (await scrypt(password, salt, 64)) as Buffer;
    return `${salt}:${derived.toString('hex')}`;
  }

  private hashResetToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private resetTtlMs(): number {
    const configured = Number(this.config?.get<string>('PASSWORD_RESET_TTL_MS', String(RESET_TTL_MS)));
    return Number.isFinite(configured) && configured > 0 ? configured : RESET_TTL_MS;
  }

  private async verifyPassword(password: string, stored: string): Promise<boolean> {
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    const storedBuffer = Buffer.from(hash, 'hex');
    const derived = (await scrypt(password, salt, storedBuffer.length)) as Buffer;
    return storedBuffer.length === derived.length && timingSafeEqual(storedBuffer, derived);
  }
}
