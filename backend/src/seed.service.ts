import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService } from './auth/auth.service';
import { Activity, ActivityPhase } from './entities/activity.entity';
import { AiDeclaration } from './entities/ai-declaration.entity';
import { AcademicClass } from './entities/class.entity';
import { Enrollment } from './entities/enrollment.entity';
import { Logbook } from './entities/logbook.entity';
import { Notification, NotificationType } from './entities/notification.entity';
import { Rubric, RubricCriterion } from './entities/rubric.entity';
import { EvaluationStatus, Submission, SubmissionStatus } from './entities/submission.entity';
import { User, UserRole } from './entities/user.entity';
import { Valuation } from './entities/valuation.entity';

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
    @InjectRepository(Valuation) private readonly valuations: Repository<Valuation>,
    @InjectRepository(Notification) private readonly notifications: Repository<Notification>,
    private readonly authService: AuthService,
  ) {}

  async onApplicationBootstrap() {
    if ((process.env.DEMO_SEED ?? 'true') !== 'true') return;

    // ─── Usuarios ─────────────────────────────────────────────────────────────
    const student = await this.ensureUser('estudiante@unah.edu.hn', 'Diego Reyes', 'Estudiante123!', UserRole.STUDENT);
    const student2 = await this.ensureUser('estudiante2@unah.edu.hn', 'María López', 'Estudiante123!', UserRole.STUDENT);
    const teacher = await this.ensureUser('docente@unah.edu.hn', 'Carlos Torres', 'Docente123!', UserRole.TEACHER);

    // ─── Clase ────────────────────────────────────────────────────────────────
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

    // Matricular ambos estudiantes
    await this.ensureEnrollment(student, academicClass);
    await this.ensureEnrollment(student2, academicClass);

    // ─── Rúbrica ──────────────────────────────────────────────────────────────
    let rubric = await this.rubrics.findOne({ where: { name: 'Rúbrica de ensayo argumentativo' } });
    if (!rubric) {
      rubric = await this.rubrics.save(
        this.rubrics.create({
          name: 'Rúbrica de ensayo argumentativo',
          teacher,
          criteria: this.demoRubricCriteria(),
        }),
      );
    }

    // ─── 4 Actividades con datos históricos (HU-32 y HU-33) ──────────────────
    const activityDefs = [
      { title: 'Análisis de caso — IA en salud', dueDate: '2026-07-10', weight: 1.0, scores: { student: [3, 3, 2, 3, 3, 2, 3], student2: [2, 2, 2, 2, 2, 3, 2] } },
      { title: 'Ensayo sobre privacidad de datos', dueDate: '2026-07-28', weight: 1.5, scores: { student: [3, 4, 3, 4, 3, 3, 4], student2: [3, 3, 3, 3, 3, 3, 3] } },
      { title: 'Debate ético — autos autónomos', dueDate: '2026-08-15', weight: 1.0, scores: { student: [4, 4, 4, 3, 4, 4, 4], student2: [3, 4, 3, 4, 3, 3, 4] } },
      { title: 'Ensayo sobre ética e IA', dueDate: '2026-09-15', weight: 2.0, scores: null }, // pendiente de calificar
    ];

    for (const def of activityDefs) {
      await this.ensureActivity(def, academicClass, teacher, rubric, student, student2);
    }

    // ─── Notificaciones de demostración (HU-34) ───────────────────────────────
    await this.ensureDemoNotifications(student);
  }

  // ─── Helpers de seed ─────────────────────────────────────────────────────────

  private async ensureActivity(
    def: { title: string; dueDate: string; weight: number; scores: { student: number[]; student2: number[] } | null },
    academicClass: AcademicClass,
    teacher: User,
    rubric: Rubric,
    student: User,
    student2: User,
  ) {
    let activity = await this.activities.findOne({ where: { title: def.title } });
    if (!activity) {
      activity = await this.activities.save(
        this.activities.create({
          title: def.title,
          subject: academicClass.subject,
          dueDate: def.dueDate,
          activityType: 'Ensayo',
          evaluationPhase: ActivityPhase.PILOT,
          learningOutcomes: ['Analiza implicaciones éticas del uso de IA.'],
          teacher,
          academicClass,
          manualEvaluationRequired: false,
          weight: def.weight,
          rubric,
        }),
      );
    }

    // Datos para ambos estudiantes
    for (const { user, scores } of [
      { user: student, scores: def.scores?.student ?? null },
      { user: student2, scores: def.scores?.student2 ?? null },
    ]) {
      await this.ensureLogbook(user, activity);
      await this.ensureDeclaration(user, activity);
      const submission = await this.ensureSubmission(user, activity, scores !== null);
      if (scores && submission) {
        await this.ensureValuations(submission, activity, teacher, rubric, scores);
      }
    }
  }

  private async ensureLogbook(student: User, activity: Activity) {
    const existing = await this.logbooks.findOne({
      where: { student: { id: student.id }, activity: { id: activity.id } },
    });
    if (!existing) {
      await this.logbooks.save(
        this.logbooks.create({
          student,
          activity,
          initialIdeas: `Ideas iniciales para "${activity.title}": explorar fuentes primarias y contrastar con experiencias reales.`,
          prompts: 'Prompt 1: "Resume los puntos clave del debate ético en 3 párrafos."\nPrompt 2: "Dame 3 contraargumentos al uso de IA en este contexto."',
          validationsAndDecisions: 'Validé las fuentes con Google Scholar. Decidí enfocarme en el impacto social sobre el individual.',
          finalReflection: 'Aprendí que la ética en IA no es binaria — depende del contexto, los actores y las consecuencias reales.',
        }),
      );
    }
  }

  private async ensureDeclaration(student: User, activity: Activity) {
    const existing = await this.declarations.findOne({
      where: { student: { id: student.id }, activity: { id: activity.id } },
    });
    if (!existing) {
      await this.declarations.save(
        this.declarations.create({
          student,
          activity,
          toolName: 'ChatGPT',
          usageLevel: 2,
          detectedUsageLevel: null,
          usageDiscrepancy: false,
          purpose: 'Organizar ideas y estructurar argumentos. No generé contenido directamente.',
          promptSummary: 'Le pedí al modelo que me ayudara a identificar falacias lógicas en mi argumentación inicial y que sugiriera fuentes académicas relevantes.',
        }),
      );
    }
  }

  private async ensureSubmission(student: User, activity: Activity, evaluated: boolean): Promise<Submission | null> {
    const existing = await this.submissions.findOne({
      where: { student: { id: student.id }, activity: { id: activity.id } },
    });
    if (existing) return existing;
    return this.submissions.save(
      this.submissions.create({
        student,
        activity,
        status: evaluated ? SubmissionStatus.EVALUATED : SubmissionStatus.SUBMITTED,
        evaluationStatus: evaluated ? EvaluationStatus.NOT_REQUESTED : EvaluationStatus.NOT_REQUESTED,
        manualReviewRequired: false,
        submittedAt: new Date(activity.dueDate),
        productText: `Producto final para "${activity.title}". Este texto representa el ensayo entregado por el estudiante con análisis crítico y reflexión sobre el uso ético de la inteligencia artificial en contextos académicos y profesionales.`,
        productUrl: '',
        fileName: null,
        fileMimeType: null,
        fileBase64: null,
      }),
    );
  }

  private async ensureValuations(
    submission: Submission,
    activity: Activity,
    teacher: User,
    rubric: Rubric,
    scores: number[],
  ) {
    const existing = await this.valuations.count({ where: { submission: { id: submission.id } } });
    if (existing > 0) return;
    for (let i = 0; i < rubric.criteria.length; i++) {
      const criterion = rubric.criteria[i];
      const teacherVal = scores[i] ?? 3;
      await this.valuations.save(
        this.valuations.create({
          activity,
          submission,
          criterion: criterion.name,
          dimension: criterion.dimension,
          aiValue: Math.max(1, Math.min(4, teacherVal - 1 + Math.round(Math.random()))),
          aiExplanation: `La IA identificó evidencia ${teacherVal >= 3 ? 'sólida' : 'parcial'} para este criterio.`,
          teacherValue: teacherVal,
          teacherComment: teacherVal >= 4
            ? 'Excelente trabajo, evidencia muy bien sustentada.'
            : teacherVal === 3
            ? 'Buen trabajo, puede mejorar en profundidad.'
            : 'Necesita mayor desarrollo y sustento.',
          confirmed: true,
        }),
      );
    }
  }

  private async ensureDemoNotifications(student: User) {
    const existing = await this.notifications.count({ where: { user: { id: student.id } } });
    if (existing > 0) return;

    // Notificaciones de calificación
    const notifData = [
      { title: 'Tu entrega ha sido calificada', message: 'Tu entrega de "Análisis de caso — IA en salud" ya tiene retroalimentación.', activityId: null, daysAgo: 28 },
      { title: 'Tu entrega ha sido calificada', message: 'Tu entrega de "Ensayo sobre privacidad de datos" ya tiene retroalimentación.', activityId: null, daysAgo: 14 },
      { title: 'Tu entrega ha sido calificada', message: 'Tu entrega de "Debate ético — autos autónomos" ya tiene retroalimentación.', activityId: null, daysAgo: 3 },
    ];

    for (const n of notifData) {
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - n.daysAgo);
      const notif = this.notifications.create({
        user: student,
        type: NotificationType.GRADE_PUBLISHED,
        title: n.title,
        message: n.message,
        read: n.daysAgo > 5,
        activityId: n.activityId,
      });
      (notif as unknown as Record<string, unknown>).createdAt = createdAt;
      await this.notifications.save(notif);
    }
  }

  private async ensureEnrollment(student: User, academicClass: AcademicClass) {
    const existing = await this.enrollments.findOne({
      where: { student: { id: student.id }, academicClass: { id: academicClass.id } },
    });
    if (!existing) {
      await this.enrollments.save(
        this.enrollments.create({ student, academicClass, active: true }),
      );
    } else if (!existing.active) {
      existing.active = true;
      await this.enrollments.save(existing);
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
