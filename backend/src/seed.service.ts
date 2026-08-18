import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService } from './auth/auth.service';
import { Activity } from './entities/activity.entity';
import { AiDeclaration } from './entities/ai-declaration.entity';
import { AcademicClass } from './entities/class.entity';
import { Enrollment } from './entities/enrollment.entity';
import { Logbook } from './entities/logbook.entity';
import { Rubric, RubricCriterion } from './entities/rubric.entity';
import { Submission, SubmissionStatus } from './entities/submission.entity';
import { User, UserRole } from './entities/user.entity';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(AcademicClass) private readonly classes: Repository<AcademicClass>,
    @InjectRepository(Enrollment) private readonly enrollments: Repository<Enrollment>,
    @InjectRepository(Activity) private readonly activities: Repository<Activity>,
    @InjectRepository(Rubric) private readonly rubrics: Repository<Rubric>,
    @InjectRepository(Logbook) private readonly logbooks: Repository<Logbook>,
    @InjectRepository(Submission) private readonly submissions: Repository<Submission>,
    @InjectRepository(AiDeclaration) private readonly declarations: Repository<AiDeclaration>,
    private readonly authService: AuthService,
  ) {}

  async onApplicationBootstrap() {
    if ((process.env.DEMO_SEED ?? 'true') !== 'true') return;
    const student = await this.ensureUser(
      'estudiante@unah.edu.hn',
      'Estudiante de prueba',
      'Estudiante123!',
      UserRole.STUDENT,
    );
    const teacher = await this.ensureUser(
      'docente@unah.edu.hn',
      'Docente de prueba',
      'Docente123!',
      UserRole.TEACHER,
    );

    let academicClass = await this.classes.findOne({ where: { code: 'IS-2026-03' } });
    if (!academicClass) {
      academicClass = await this.classes.save(
        this.classes.create({
          name: 'Ingeniería del Software — Piloto',
          subject: 'Ingeniería del Software',
          code: 'IS-2026-03',
          period: 'III PAC 2026',
          teacher,
        }),
      );
    }

    let enrollment = await this.enrollments.findOne({
      where: { student: { id: student.id }, academicClass: { id: academicClass.id } },
    });
    if (!enrollment) {
      enrollment = this.enrollments.create({ student, academicClass, active: true });
    }
    enrollment.active = true;
    await this.enrollments.save(enrollment);

    let activity = await this.activities.findOne({ where: { title: 'Ensayo sobre ética e IA' } });
    if (!activity) {
      activity = await this.activities.save(
        this.activities.create({
          title: 'Ensayo sobre ética e IA',
          subject: academicClass.subject,
          dueDate: '2026-09-15',
          activityType: 'Ensayo',
          learningOutcomes: ['Argumenta decisiones éticas sobre el uso académico de IA.'],
          teacher,
          academicClass,
          rubric: null,
        }),
      );
    } else if (!activity.academicClass || activity.academicClass.id !== academicClass.id) {
      activity.academicClass = academicClass;
      activity.subject = academicClass.subject;
      activity = await this.activities.save(activity);
    }

    let rubric = await this.rubrics.findOne({ where: { name: 'Rúbrica de ensayo argumentativo' } });
    if (!rubric) {
      rubric = await this.rubrics.save(
        this.rubrics.create({
          name: 'Rúbrica de ensayo argumentativo',
          teacher,
          activity,
          criteria: this.demoRubricCriteria(),
        }),
      );
    } else if (rubric.criteria.length !== 7) {
      rubric.criteria = this.demoRubricCriteria();
      rubric = await this.rubrics.save(rubric);
    }

    const existingLogbook = await this.logbooks.findOne({
      where: { student: { id: student.id }, activity: { id: activity.id } },
    });
    if (!existingLogbook) {
      await this.logbooks.save(
        this.logbooks.create({
          student,
          activity,
          initialIdeas: 'Analizaré beneficios, riesgos y responsabilidades del uso académico de IA.',
          prompts: '',
          validationsAndDecisions: '',
          finalReflection: '',
        }),
      );
    }

    const existingSubmission = await this.submissions.findOne({
      where: { student: { id: student.id }, activity: { id: activity.id } },
    });
    if (!existingSubmission) {
      await this.submissions.save(
        this.submissions.create({
          student,
          activity,
          status: SubmissionStatus.SUBMITTED,
          submittedAt: new Date(),
          productText: 'Borrador de demostración del ensayo sobre ética e inteligencia artificial.',
          productUrl: '',
          fileName: null,
          fileMimeType: null,
          fileBase64: null,
        }),
      );
    }

    const existingDeclaration = await this.declarations.findOne({
      where: { student: { id: student.id }, activity: { id: activity.id } },
    });
    if (!existingDeclaration) {
      await this.declarations.save(
        this.declarations.create({
          student,
          activity,
          toolName: 'ChatGPT',
          usageLevel: 2,
          detectedUsageLevel: null,
          purpose: 'Organizar ideas y contrastar perspectivas.',
          promptSummary: 'Consultas sobre argumentos éticos y posibles contraargumentos.',
        }),
      );
    }
  }

  private async ensureUser(email: string, name: string, password: string, role: UserRole) {
    let user = await this.users.findOne({ where: { email } });
    if (!user) {
      user = await this.users.save(
        this.users.create({
          email,
          name,
          role,
          active: true,
          passwordHash: await this.authService.hashPassword(password),
        }),
      );
    }
    return user;
  }

  private demoRubricCriteria(): RubricCriterion[] {
    const dimensions = [
      'Comprensión',
      'Razonamiento',
      'Argumentación',
      'Validación de fuentes',
      'Toma de decisiones',
      'Transparencia en el uso de IA',
      'Reflexión final',
    ];
    return dimensions.map((dimension) => ({
      name: dimension,
      dimension,
      descriptors: {
        level1: 'La evidencia es insuficiente o no permite demostrar el criterio.',
        level2: 'La evidencia demuestra el criterio de manera parcial.',
        level3: 'La evidencia demuestra el criterio de forma clara y sustentada.',
        level4: 'La evidencia demuestra dominio, profundidad y validación consistente.',
      },
    }));
  }
}
