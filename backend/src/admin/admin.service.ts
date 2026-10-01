import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { User, UserRole } from '../entities/user.entity';
import { MailService } from '../mail/mail.service';
import { CreateTeacherDto } from './admin.dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly authService: AuthService,
    private readonly mailService: MailService,
  ) {}

  async listTeachers() {
    const teachers = await this.users.find({
      where: { role: UserRole.TEACHER },
      order: { name: 'ASC', email: 'ASC' },
    });
    return teachers.map((teacher) => this.teacherResponse(teacher));
  }

  async createTeacher(input: CreateTeacherDto) {
    const email = input.email.trim().toLowerCase();
    if (await this.users.findOne({ where: { email } })) {
      throw new ConflictException('Ya existe una cuenta con este correo');
    }

    const temporaryPassword = this.generateTemporaryPassword();
    const teacher = await this.users.save(
      this.users.create({
        email,
        name: input.name.trim(),
        passwordHash: await this.authService.hashPassword(temporaryPassword),
        role: UserRole.TEACHER,
        active: true,
        mustChangePassword: true,
      }),
    );

    let invitationEmailSent = false;
    try {
      invitationEmailSent = await this.mailService.sendTeacherInvitationEmail(
        teacher.email,
        teacher.name,
        temporaryPassword,
      );
    } catch (error) {
      this.logger.error(
        `No fue posible enviar la invitación al docente ${teacher.email}`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    return {
      ...this.teacherResponse(teacher),
      invitationEmailSent,
    };
  }

  private teacherResponse(teacher: User) {
    return {
      id: teacher.id,
      name: teacher.name,
      email: teacher.email,
      active: teacher.active,
      mustChangePassword: teacher.mustChangePassword,
    };
  }

  private generateTemporaryPassword(): string {
    return `Tt!${randomBytes(18).toString('base64url')}`;
  }
}
