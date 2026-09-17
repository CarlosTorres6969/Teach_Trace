import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { In, Repository } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { AcademicClass } from '../entities/class.entity';
import { Enrollment } from '../entities/enrollment.entity';
import { User, UserRole } from '../entities/user.entity';
import { MailService } from '../mail/mail.service';
import { CreateClassDto } from './classes.dto';

@Injectable()
export class ClassesService {
  private readonly logger = new Logger(ClassesService.name);

  constructor(
    @InjectRepository(AcademicClass) private readonly classes: Repository<AcademicClass>,
    @InjectRepository(Enrollment) private readonly enrollments: Repository<Enrollment>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly authService: AuthService,
    private readonly mailService: MailService,
  ) {}

  async listForTeacher(teacherId: number) {
    const classes = await this.classes.find({
      where: { teacher: { id: teacherId } },
      order: { id: 'DESC' },
    });
    return Promise.all(classes.map((academicClass) => this.classResponse(academicClass)));
  }

  async create(teacher: User, input: CreateClassDto) {
    const code = input.code.trim().toUpperCase();
    if (await this.classes.findOne({ where: { code } })) {
      throw new ConflictException('Ya existe una clase con ese código');
    }
    const academicClass = await this.classes.save(
      this.classes.create({
        name: input.name.trim(),
        subject: input.subject.trim(),
        code,
        period: input.period.trim(),
        teacher,
      }),
    );
    return this.classResponse(academicClass);
  }

  async enrollStudent(teacherId: number, classId: number, email: string, name?: string) {
    const academicClass = await this.ownedClass(teacherId, classId);
    const normalizedEmail = email.trim().toLowerCase();
    let student = await this.users.findOne({ where: { email: normalizedEmail } });
    let accountCreated = false;
    let invitationEmailSent: boolean | null = null;
    let enrollmentEmailSent: boolean | null = null;
    let temporaryPassword: string | null = null;

    if (student && student.role !== UserRole.STUDENT) {
      throw new ConflictException('El correo pertenece a una cuenta que no es estudiantil');
    }
    if (student && !student.active) {
      throw new ConflictException('La cuenta estudiantil está desactivada');
    }
    if (!student) {
      const studentName = name?.trim();
      if (!studentName) {
        throw new BadRequestException('El nombre es obligatorio para crear un estudiante nuevo');
      }
      temporaryPassword = this.generateTemporaryPassword();
      student = await this.users.save(
        this.users.create({
          email: normalizedEmail,
          name: studentName,
          role: UserRole.STUDENT,
          active: true,
          mustChangePassword: true,
          passwordHash: await this.authService.hashPassword(temporaryPassword),
        }),
      );
      accountCreated = true;
    }

    let enrollment = await this.enrollments.findOne({
      where: { student: { id: student.id }, academicClass: { id: classId } },
    });
    const shouldNotifyExistingStudent = !accountCreated && !enrollment?.active;
    if (!enrollment) enrollment = this.enrollments.create({ student, academicClass });
    enrollment.active = true;
    await this.enrollments.save(enrollment);

    if (accountCreated && temporaryPassword) {
      try {
        invitationEmailSent = await this.mailService.sendTemporaryPasswordEmail(
          student.email,
          student.name,
          temporaryPassword,
          {
            name: academicClass.name,
            subject: academicClass.subject,
            code: academicClass.code,
            period: academicClass.period,
          },
        );
      } catch (error) {
        invitationEmailSent = false;
        this.logger.error(
          `No fue posible enviar la contraseña temporal a ${student.email}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    } else if (shouldNotifyExistingStudent) {
      enrollmentEmailSent = await this.sendEnrollmentNotification(student, academicClass);
    }
    return {
      ...this.enrollmentResponse(enrollment),
      accountCreated,
      invitationEmailSent,
      enrollmentEmailSent,
    };
  }

  async enrollStudents(teacherId: number, classId: number, emails: string[]) {
    const academicClass = await this.ownedClass(teacherId, classId);
    const normalizedEmails = [
      ...new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean)),
    ];
    const students = await this.users.find({
      where: {
        email: In(normalizedEmails),
        role: UserRole.STUDENT,
        active: true,
      },
    });
    const studentsByEmail = new Map(students.map((student) => [student.email, student]));
    const existingEnrollments = students.length
      ? await this.enrollments.find({
          where: {
            academicClass: { id: classId },
            student: { id: In(students.map((student) => student.id)) },
          },
        })
      : [];
    const enrollmentsByStudent = new Map(
      existingEnrollments.map((enrollment) => [enrollment.student.id, enrollment]),
    );
    const enrollmentsToSave: Enrollment[] = [];
    let enrolledCount = 0;
    let alreadyEnrolledCount = 0;

    for (const student of students) {
      const existing = enrollmentsByStudent.get(student.id);
      if (existing?.active) {
        alreadyEnrolledCount += 1;
        continue;
      }
      const enrollment = existing ?? this.enrollments.create({ student, academicClass });
      enrollment.active = true;
      enrollmentsToSave.push(enrollment);
      enrolledCount += 1;
    }

    if (enrollmentsToSave.length) await this.enrollments.save(enrollmentsToSave);

    for (let index = 0; index < enrollmentsToSave.length; index += 5) {
      const batch = enrollmentsToSave.slice(index, index + 5);
      await Promise.all(
        batch.map((enrollment) =>
          this.sendEnrollmentNotification(enrollment.student, academicClass),
        ),
      );
    }

    return {
      processedCount: normalizedEmails.length,
      enrolledCount,
      alreadyEnrolledCount,
      notFoundEmails: normalizedEmails.filter((email) => !studentsByEmail.has(email)),
    };
  }

  async listEnrollments(teacherId: number, classId: number) {
    await this.ownedClass(teacherId, classId);
    const enrollments = await this.enrollments.find({
      where: { academicClass: { id: classId }, active: true },
      order: { enrolledAt: 'ASC' },
    });
    return enrollments.map((enrollment) => this.enrollmentResponse(enrollment));
  }

  async ownedClass(teacherId: number, classId: number) {
    const academicClass = await this.classes.findOne({
      where: { id: classId, teacher: { id: teacherId } },
    });
    if (!academicClass) throw new NotFoundException('La clase no existe o no pertenece al docente');
    return academicClass;
  }

  async isStudentEnrolled(studentId: number, classId: number) {
    return Boolean(
      await this.enrollments.findOne({
        where: { student: { id: studentId }, academicClass: { id: classId }, active: true },
      }),
    );
  }

  async sharedClassExists(studentId: number, teacherId: number): Promise<boolean> {
    const teacherClasses = await this.classes.find({
      where: { teacher: { id: teacherId } },
    });
    if (!teacherClasses.length) return false;
    const classIds = teacherClasses.map((c) => c.id);
    const enrollment = await this.enrollments.findOne({
      where: {
        student: { id: studentId },
        academicClass: { id: In(classIds) },
        active: true,
      },
    });
    return !!enrollment;
  }

  private async classResponse(academicClass: AcademicClass) {
    const enrollments = await this.enrollments.find({
      where: { academicClass: { id: academicClass.id }, active: true },
      order: { enrolledAt: 'ASC' },
    });
    return {
      id: academicClass.id,
      name: academicClass.name,
      subject: academicClass.subject,
      code: academicClass.code,
      period: academicClass.period,
      studentCount: enrollments.length,
      students: enrollments.map((enrollment) => ({
        id: enrollment.student.id,
        name: enrollment.student.name,
        email: enrollment.student.email,
      })),
    };
  }

  private enrollmentResponse(enrollment: Enrollment) {
    return {
      id: enrollment.id,
      enrolledAt: enrollment.enrolledAt,
      student: {
        id: enrollment.student.id,
        name: enrollment.student.name,
        email: enrollment.student.email,
      },
    };
  }

  private async sendEnrollmentNotification(
    student: User,
    academicClass: AcademicClass,
  ): Promise<boolean> {
    try {
      return await this.mailService.sendEnrollmentEmail(
        student.email,
        student.name,
        {
          name: academicClass.name,
          subject: academicClass.subject,
          code: academicClass.code,
          period: academicClass.period,
        },
      );
    } catch (error) {
      this.logger.error(
        `No fue posible enviar la notificación de matrícula a ${student.email}`,
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }

  private generateTemporaryPassword(): string {
    return `Tt!${randomBytes(18).toString('base64url')}`;
  }
}
