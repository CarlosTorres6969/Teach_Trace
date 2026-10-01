import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { User, UserRole } from '../entities/user.entity';

@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    const email = this.config.get<string>('ADMIN_EMAIL')?.trim().toLowerCase() ?? '';
    const name = this.config.get<string>('ADMIN_NAME')?.trim() ?? '';
    const password = this.config.get<string>('ADMIN_TEMPORARY_PASSWORD') ?? '';
    if (!email && !name && !password) return;

    if (!email || !name || !password) {
      throw new Error(
        'ADMIN_EMAIL, ADMIN_NAME y ADMIN_TEMPORARY_PASSWORD deben configurarse juntos',
      );
    }
    if (!email.includes('@')) throw new Error('ADMIN_EMAIL no es válido');
    if (name.length < 2 || name.length > 120) throw new Error('ADMIN_NAME no es válido');
    if (password.length < 12) {
      throw new Error('ADMIN_TEMPORARY_PASSWORD debe tener al menos 12 caracteres');
    }

    const existing = await this.users.findOne({ where: { email } });
    if (existing) {
      if (existing.role !== UserRole.ADMIN) {
        throw new Error('ADMIN_EMAIL ya pertenece a una cuenta con otro rol');
      }
      return;
    }

    await this.users.save(
      this.users.create({
        email,
        name,
        passwordHash: await this.authService.hashPassword(password),
        role: UserRole.ADMIN,
        active: true,
        mustChangePassword: true,
      }),
    );
    this.logger.log(`Cuenta administradora inicial creada para ${email}`);
  }
}
