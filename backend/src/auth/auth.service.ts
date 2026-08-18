import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { Repository } from 'typeorm';
import { AuthSession } from '../entities/auth-session.entity';
import { User } from '../entities/user.entity';
import { LoginDto } from './login.dto';

const scrypt = promisify(nodeScrypt);
const SESSION_HOURS = 8;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(AuthSession) private readonly sessions: Repository<AuthSession>,
    private readonly jwtService: JwtService,
  ) {}

  async login(input: LoginDto) {
    const email = input.email.trim().toLowerCase();
    const user = await this.users.findOne({ where: { email, active: true } });
    if (!user || !(await this.verifyPassword(input.password, user.passwordHash))) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }

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

  safeUser(user: User) {
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }

  async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derived = (await scrypt(password, salt, 64)) as Buffer;
    return `${salt}:${derived.toString('hex')}`;
  }

  private async verifyPassword(password: string, stored: string): Promise<boolean> {
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    const storedBuffer = Buffer.from(hash, 'hex');
    const derived = (await scrypt(password, salt, storedBuffer.length)) as Buffer;
    return storedBuffer.length === derived.length && timingSafeEqual(storedBuffer, derived);
  }
}
