import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService } from './auth/auth.service';
import { Activity, ActivityPhase } from './entities/activity.entity';
import { AiDeclaration } from './entities/ai-declaration.entity';
import { AcademicClass } from './entities/class.entity';
import { Enrollment } from './entities/enrollment.entity';
import { ForumPost } from './entities/forum-post.entity';
import { ForumThread } from './entities/forum-thread.entity';
import { Logbook } from './entities/logbook.entity';
import { Notification, NotificationType } from './entities/notification.entity';
import { Rubric, RubricCriterion } from './entities/rubric.entity';
import { EvaluationStatus, Submission, SubmissionStatus } from './entities/submission.entity';
import { User, UserRole } from './entities/user.entity';
import { Valuation } from './entities/valuation.entity';

type LogbookSeedState = 'partial' | 'complete';

type SubmissionSeed = {
  status: SubmissionStatus;
  evaluationStatus: EvaluationStatus;
  submittedDaysAgo: number;
  manualReviewRequired?: boolean;
  withFile?: boolean;
};

type StudentWorkSeed = {
  student: User;
  logbook?: LogbookSeedState;
  declaration?: boolean;
  submission?: SubmissionSeed;
  scores?: number[];
  draftValuations?: boolean;
};

type ActivitySeed = {
  title: string;
  academicClass: AcademicClass;
  dueInDays: number;
  activityType: string;
  phase: ActivityPhase;
  weight: number;
  createdDaysAgo: number;
  viewedBy?: User[];
  learningOutcomes: string[];
  work: StudentWorkSeed[];
};

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

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
    @InjectRepository(ForumThread) private readonly forumThreads: Repository<ForumThread>,
    @InjectRepository(ForumPost) private readonly forumPosts: Repository<ForumPost>,
    private readonly authService: AuthService,
  ) {}

  async onApplicationBootstrap() {
    if ((process.env.DEMO_SEED ?? 'true') !== 'true') return;

    const teacher = await this.ensureUser(
      'docente@unah.edu.hn',
      'Carlos Torres',
      'Docente123!',
      UserRole.TEACHER,
    );
    const student = await this.ensureUser(
      'estudiante@unah.edu.hn',
      'Diego Reyes',
      'Estudiante123!',
      UserRole.STUDENT,
    );
    const student2 = await this.ensureUser(
      'estudiante2@unah.edu.hn',
      'María López',
      'Estudiante123!',
      UserRole.STUDENT,
    );
    const student3 = await this.ensureUser(
      'estudiante3@unah.edu.hn',
      'Ana Martínez',
      'Estudiante123!',
      UserRole.STUDENT,
    );
    const student4 = await this.ensureUser(
      'estudiante4@unah.edu.hn',
      'Luis Hernández',
      'Estudiante123!',
      UserRole.STUDENT,
    );
    const student5 = await this.ensureUser(
      'estudiante5@unah.edu.hn',
      'Sofía Castillo',
      'Estudiante123!',
      UserRole.STUDENT,
    );

    const softwareClass = await this.ensureClass({
      name: 'Ingeniería del Software — Piloto',
      subject: 'Ingeniería del Software',
      code: 'IS-2026-03',
      period: 'III PAC 2026',
      teacher,
    });
    const databaseClass = await this.ensureClass({
      name: 'Bases de Datos — Laboratorio',
      subject: 'Bases de Datos',
      code: 'BD-2026-03',
      period: 'III PAC 2026',
      teacher,
    });
    const webClass = await this.ensureClass({
      name: 'Programación Web — Proyecto',
      subject: 'Programación Web',
      code: 'PW-2026-03',
      period: 'III PAC 2026',
      teacher,
    });

    for (const enrolledStudent of [student, student2, student3, student4, student5]) {
      await this.ensureEnrollment(enrolledStudent, softwareClass);
    }
    for (const enrolledStudent of [student, student2, student3, student4]) {
      await this.ensureEnrollment(enrolledStudent, databaseClass);
    }
    for (const enrolledStudent of [student, student2, student5]) {
      await this.ensureEnrollment(enrolledStudent, webClass);
    }

    const evaluated = (
      submittedDaysAgo: number,
      scores: number[],
      evaluatedStudent: User,
    ): StudentWorkSeed => ({
      student: evaluatedStudent,
      logbook: 'complete',
      declaration: true,
      submission: {
        status: SubmissionStatus.EVALUATED,
        evaluationStatus: EvaluationStatus.VALIDATED,
        submittedDaysAgo,
      },
      scores,
    });
    const submitted = (
      submittedStudent: User,
      submittedDaysAgo: number,
      withFile = false,
    ): StudentWorkSeed => ({
      student: submittedStudent,
      logbook: 'complete',
      declaration: true,
      submission: {
        status: SubmissionStatus.SUBMITTED,
        evaluationStatus: EvaluationStatus.NOT_REQUESTED,
        submittedDaysAgo,
        withFile,
      },
    });
    const manualReview = (
      reviewStudent: User,
      submittedDaysAgo: number,
    ): StudentWorkSeed => ({
      student: reviewStudent,
      logbook: 'complete',
      declaration: true,
      submission: {
        status: SubmissionStatus.UNDER_REVIEW,
        evaluationStatus: EvaluationStatus.MANUAL_REQUIRED,
        submittedDaysAgo,
        manualReviewRequired: true,
      },
      draftValuations: true,
    });

    const activitySeeds: ActivitySeed[] = [
      {
        title: 'Análisis de caso — IA en salud',
        academicClass: softwareClass,
        dueInDays: -45,
        activityType: 'Análisis de caso',
        phase: ActivityPhase.BASELINE,
        weight: 1,
        createdDaysAgo: 60,
        learningOutcomes: [
          'Identifica riesgos éticos y actores afectados en un caso real.',
          'Sustenta decisiones con fuentes académicas verificables.',
        ],
        work: [
          evaluated(47, [3, 3, 2, 3, 3, 2, 3], student),
          evaluated(46, [2, 2, 2, 2, 2, 3, 2], student2),
          evaluated(45, [3, 3, 3, 2, 3, 3, 3], student3),
          evaluated(44, [2, 3, 2, 2, 3, 2, 2], student4),
          evaluated(46, [4, 3, 3, 3, 3, 3, 4], student5),
        ],
      },
      {
        title: 'Ensayo sobre privacidad de datos',
        academicClass: softwareClass,
        dueInDays: -28,
        activityType: 'Ensayo',
        phase: ActivityPhase.BASELINE,
        weight: 1.5,
        createdDaysAgo: 43,
        learningOutcomes: [
          'Argumenta sobre privacidad y protección de datos personales.',
          'Compara alternativas técnicas y sus implicaciones sociales.',
        ],
        work: [
          evaluated(30, [3, 4, 3, 4, 3, 3, 4], student),
          evaluated(29, [3, 3, 3, 3, 3, 3, 3], student2),
          evaluated(28, [3, 4, 3, 3, 4, 3, 3], student3),
          evaluated(28, [2, 3, 2, 3, 3, 2, 3], student4),
          evaluated(31, [4, 4, 3, 4, 3, 4, 4], student5),
        ],
      },
      {
        title: 'Debate ético — autos autónomos',
        academicClass: softwareClass,
        dueInDays: -12,
        activityType: 'Debate',
        phase: ActivityPhase.PILOT,
        weight: 1,
        createdDaysAgo: 26,
        learningOutcomes: [
          'Defiende una postura técnica mediante argumentos y contraargumentos.',
          'Reflexiona sobre las decisiones tomadas durante el debate.',
        ],
        work: [
          evaluated(14, [4, 4, 4, 3, 4, 4, 4], student),
          evaluated(13, [3, 4, 3, 4, 3, 3, 4], student2),
          evaluated(12, [4, 3, 4, 3, 4, 3, 4], student3),
          evaluated(12, [3, 3, 3, 3, 3, 3, 3], student4),
          evaluated(13, [4, 4, 4, 4, 3, 4, 4], student5),
        ],
      },
      {
        title: 'Plan de pruebas del sprint',
        academicClass: softwareClass,
        dueInDays: 1,
        activityType: 'Plan de pruebas',
        phase: ActivityPhase.PILOT,
        weight: 1,
        createdDaysAgo: 1,
        learningOutcomes: [
          'Diseña casos de prueba trazables a los criterios de aceptación.',
          'Prioriza riesgos funcionales antes del cierre del sprint.',
        ],
        work: [submitted(student2, 1), submitted(student3, 0), { student: student4, logbook: 'partial' }],
      },
      {
        title: 'Optimización de consultas SQL',
        academicClass: databaseClass,
        dueInDays: 2,
        activityType: 'Laboratorio',
        phase: ActivityPhase.PILOT,
        weight: 1.5,
        createdDaysAgo: 2,
        learningOutcomes: [
          'Interpreta planes de ejecución para localizar cuellos de botella.',
          'Justifica índices y reescrituras mediante evidencia medible.',
        ],
        work: [
          { student, logbook: 'complete', declaration: true },
          submitted(student2, 0, true),
          { student: student3, logbook: 'partial' },
          submitted(student4, 1),
        ],
      },
      {
        title: 'Revisión de arquitectura en equipo',
        academicClass: softwareClass,
        dueInDays: 4,
        activityType: 'Informe técnico',
        phase: ActivityPhase.PILOT,
        weight: 1.5,
        createdDaysAgo: 5,
        viewedBy: [student],
        learningOutcomes: [
          'Evalúa decisiones de arquitectura según atributos de calidad.',
          'Registra acuerdos, alternativas descartadas y evidencia del equipo.',
        ],
        work: [
          { student, logbook: 'complete' },
          { student: student2, logbook: 'complete', declaration: true },
          submitted(student3, 0),
        ],
      },
      {
        title: 'Presentación del prototipo web',
        academicClass: webClass,
        dueInDays: 5,
        activityType: 'Presentación',
        phase: ActivityPhase.PILOT,
        weight: 2,
        createdDaysAgo: 8,
        learningOutcomes: [
          'Comunica las decisiones del prototipo con claridad técnica.',
          'Demuestra el flujo principal y el manejo de errores.',
        ],
        work: [
          submitted(student, 0, true),
          submitted(student2, 1),
          { student: student5, logbook: 'complete' },
        ],
      },
      {
        title: 'Ensayo sobre ética e IA',
        academicClass: softwareClass,
        dueInDays: 8,
        activityType: 'Ensayo',
        phase: ActivityPhase.PILOT,
        weight: 2,
        createdDaysAgo: 10,
        learningOutcomes: [
          'Analiza implicaciones éticas del uso de IA en el desarrollo de software.',
          'Declara de forma transparente las herramientas utilizadas.',
        ],
        work: [
          submitted(student, 1),
          manualReview(student2, 2),
          submitted(student3, 1),
          { student: student4, logbook: 'partial' },
          { student: student5, logbook: 'complete', declaration: true },
        ],
      },
      {
        title: 'Retrospectiva y decisiones técnicas',
        academicClass: softwareClass,
        dueInDays: 12,
        activityType: 'Reflexión',
        phase: ActivityPhase.PILOT,
        weight: 1,
        createdDaysAgo: 11,
        learningOutcomes: [
          'Evalúa el impacto de las decisiones tomadas durante el sprint.',
          'Formula acciones concretas de mejora para la siguiente iteración.',
        ],
        work: [
          { student, logbook: 'complete', declaration: true },
          submitted(student2, 0),
          { student: student3, logbook: 'complete' },
        ],
      },
      {
        title: 'Diseño de esquema normalizado',
        academicClass: databaseClass,
        dueInDays: -20,
        activityType: 'Diseño',
        phase: ActivityPhase.BASELINE,
        weight: 1,
        createdDaysAgo: 34,
        learningOutcomes: [
          'Aplica formas normales a un dominio con reglas de negocio reales.',
          'Explica dependencias funcionales y decisiones de diseño.',
        ],
        work: [
          evaluated(22, [3, 3, 3, 2, 3, 3, 3], student),
          evaluated(21, [4, 3, 3, 3, 3, 3, 3], student2),
          evaluated(20, [3, 3, 2, 3, 3, 2, 3], student3),
          evaluated(21, [2, 3, 3, 2, 3, 3, 2], student4),
        ],
      },
      {
        title: 'Auditoría de integridad de datos',
        academicClass: databaseClass,
        dueInDays: 18,
        activityType: 'Informe técnico',
        phase: ActivityPhase.PILOT,
        weight: 1,
        createdDaysAgo: 9,
        learningOutcomes: [
          'Detecta inconsistencias mediante restricciones y consultas de auditoría.',
          'Propone correcciones reproducibles sin pérdida de información.',
        ],
        work: [
          { student, logbook: 'complete' },
          manualReview(student2, 0),
          submitted(student4, 0),
        ],
      },
      {
        title: 'API REST y validación de formularios',
        academicClass: webClass,
        dueInDays: -9,
        activityType: 'Laboratorio',
        phase: ActivityPhase.BASELINE,
        weight: 1,
        createdDaysAgo: 23,
        learningOutcomes: [
          'Implementa validación coherente entre cliente y servidor.',
          'Documenta respuestas exitosas y escenarios de error de una API REST.',
        ],
        work: [
          evaluated(11, [4, 3, 4, 3, 4, 3, 3], student),
          evaluated(10, [3, 3, 3, 3, 3, 3, 3], student2),
          evaluated(9, [4, 4, 3, 4, 3, 4, 3], student5),
        ],
      },
      {
        title: 'Despliegue y checklist de calidad',
        academicClass: webClass,
        dueInDays: 24,
        activityType: 'Checklist',
        phase: ActivityPhase.PILOT,
        weight: 1,
        createdDaysAgo: 12,
        learningOutcomes: [
          'Verifica accesibilidad, seguridad y observabilidad antes del despliegue.',
          'Registra evidencias que permitan repetir el proceso de publicación.',
        ],
        work: [
          { student, logbook: 'partial' },
          { student: student2, logbook: 'complete', declaration: true },
        ],
      },
    ];

    const seededActivities = new Map<string, Activity>();
    for (const definition of activitySeeds) {
      const activity = await this.ensureActivity(definition, teacher);
      seededActivities.set(definition.title, activity);
    }

    const forumThread = await this.ensureForumData(
      softwareClass,
      databaseClass,
      webClass,
      teacher,
      student,
      student2,
      student3,
    );
    await this.ensureDemoNotifications(
      student,
      softwareClass,
      forumThread,
      seededActivities,
    );

    this.logger.log(
      `Datos demo listos: 3 clases, 5 estudiantes, ${activitySeeds.length} actividades y foros con contenido.`,
    );
  }

  private async ensureActivity(definition: ActivitySeed, teacher: User) {
    let activity = await this.activities.findOne({ where: { title: definition.title } });
    const viewedByStudents = (definition.viewedBy ?? []).map((viewedStudent) => ({
      studentId: viewedStudent.id,
      viewedAt: this.dateAt(-1, 10).toISOString(),
    }));

    if (!activity) {
      activity = this.activities.create({
        title: definition.title,
        viewedByStudents,
        rubric: null,
      });
    }
    activity.subject = definition.academicClass.subject;
    activity.dueDate = this.dateOnly(definition.dueInDays);
    activity.activityType = definition.activityType;
    activity.evaluationPhase = definition.phase;
    activity.learningOutcomes = definition.learningOutcomes;
    activity.teacher = teacher;
    activity.academicClass = definition.academicClass;
    activity.manualEvaluationRequired = definition.work.some(
      (item) => item.submission?.manualReviewRequired,
    );
    activity.weight = definition.weight;
    activity.createdAt = this.dateAt(-definition.createdDaysAgo, 9);
    activity = await this.activities.save(activity);

    const rubric = await this.ensureRubric(activity, teacher);
    for (const work of definition.work) {
      if (work.logbook) await this.ensureLogbook(work.student, activity, work.logbook);
      if (work.declaration) await this.ensureDeclaration(work.student, activity);
      if (!work.submission) continue;
      const submission = await this.ensureSubmission(work.student, activity, work.submission);
      if (work.scores) {
        await this.ensureValuations(submission, activity, rubric, work.scores, true);
      } else if (work.draftValuations) {
        await this.ensureValuations(submission, activity, rubric, [], false);
      }
    }
    return activity;
  }

  private async ensureRubric(activity: Activity, teacher: User) {
    const name = `Rúbrica demo · ${activity.title}`;
    let rubric = await this.rubrics.findOne({
      where: { name },
      relations: { activity: true },
    });
    const currentlyAssigned = await this.rubrics.findOne({
      where: { activity: { id: activity.id } },
      relations: { activity: true },
    });
    if (currentlyAssigned && currentlyAssigned.id !== rubric?.id) {
      currentlyAssigned.activity = null;
      await this.rubrics.save(currentlyAssigned);
    }
    if (!rubric) {
      rubric = this.rubrics.create({ name, teacher, activity, criteria: this.demoRubricCriteria() });
    } else {
      rubric.teacher = teacher;
      rubric.activity = activity;
      rubric.criteria = this.demoRubricCriteria();
    }
    return this.rubrics.save(rubric);
  }

  private async ensureLogbook(student: User, activity: Activity, state: LogbookSeedState) {
    const existing = await this.logbooks.findOne({
      where: { student: { id: student.id }, activity: { id: activity.id } },
    });
    if (existing) return existing;
    const complete = state === 'complete';
    return this.logbooks.save(
      this.logbooks.create({
        student,
        activity,
        initialIdeas: `Para “${activity.title}” voy a delimitar el problema, listar supuestos y reunir evidencia antes de elegir una solución.`,
        prompts: complete
          ? 'Pedí una lista de preguntas para revisar mis supuestos y luego comparé las respuestas con la documentación del curso.'
          : '',
        validationsAndDecisions: complete
          ? 'Contrasté cada recomendación con dos fuentes y documenté por qué acepté o descarté las alternativas.'
          : '',
        finalReflection: complete
          ? 'La evidencia cambió parte de mi propuesta inicial. La próxima vez validaré los riesgos críticos desde el primer borrador.'
          : '',
      }),
    );
  }

  private async ensureDeclaration(student: User, activity: Activity) {
    const existing = await this.declarations.findOne({
      where: { student: { id: student.id }, activity: { id: activity.id } },
    });
    if (existing) return existing;
    return this.declarations.save(
      this.declarations.create({
        student,
        activity,
        toolName: 'ChatGPT',
        usageLevel: 2,
        detectedUsageLevel: null,
        usageDiscrepancy: false,
        purpose: 'Organizar ideas, identificar puntos débiles y preparar preguntas de verificación.',
        promptSummary: 'Solicité preguntas críticas y alternativas; verifiqué cada sugerencia antes de incorporarla al trabajo.',
      }),
    );
  }

  private async ensureSubmission(
    student: User,
    activity: Activity,
    seed: SubmissionSeed,
  ): Promise<Submission> {
    const existing = await this.submissions.findOne({
      where: { student: { id: student.id }, activity: { id: activity.id } },
    });
    if (existing) {
      if (seed.status === SubmissionStatus.EVALUATED) {
        existing.status = SubmissionStatus.EVALUATED;
        existing.evaluationStatus = EvaluationStatus.VALIDATED;
        existing.manualReviewRequired = false;
        existing.notificationSentAt ??= this.dateAt(-Math.max(1, seed.submittedDaysAgo - 2), 16);
        return this.submissions.save(existing);
      }
      return existing;
    }

    const fileContent = seed.withFile
      ? Buffer.from(
          `Evidencia de demostración\nActividad: ${activity.title}\nEstudiante: ${student.name}\n`,
          'utf8',
        ).toString('base64')
      : null;
    const submittedAt = this.dateAt(-seed.submittedDaysAgo, 15);
    return this.submissions.save(
      this.submissions.create({
        student,
        activity,
        status: seed.status,
        evaluationStatus: seed.evaluationStatus,
        manualReviewRequired: seed.manualReviewRequired ?? false,
        submittedAt,
        productText: `Entrega de demostración para “${activity.title}”. Incluye contexto, decisiones justificadas, evidencia revisada y una reflexión sobre los resultados obtenidos.`,
        productUrl: '',
        fileName: seed.withFile ? 'evidencia-demo.pdf' : null,
        fileMimeType: seed.withFile ? 'application/pdf' : null,
        fileBase64: fileContent,
        notificationSentAt:
          seed.status === SubmissionStatus.EVALUATED
            ? this.dateAt(-Math.max(1, seed.submittedDaysAgo - 2), 16)
            : null,
      }),
    );
  }

  private async ensureValuations(
    submission: Submission,
    activity: Activity,
    rubric: Rubric,
    scores: number[],
    published: boolean,
  ) {
    for (let index = 0; index < rubric.criteria.length; index += 1) {
      const criterion = rubric.criteria[index];
      let valuation = await this.valuations.findOne({
        where: { submission: { id: submission.id }, criterion: criterion.name },
      });
      if (valuation && !published) continue;
      const teacherValue = published ? (scores[index] ?? 3) : null;
      if (!valuation) {
        valuation = this.valuations.create({ activity, submission, criterion: criterion.name });
      }
      valuation.activity = activity;
      valuation.submission = submission;
      valuation.dimension = criterion.dimension;
      valuation.aiValue = published && teacherValue !== null
        ? Math.max(1, teacherValue - (index % 3 === 0 ? 1 : 0))
        : null;
      valuation.aiExplanation = published
        ? 'Valor ilustrativo del conjunto de datos local; la decisión publicada corresponde al docente.'
        : '';
      valuation.teacherValue = teacherValue;
      valuation.teacherComment = published
        ? teacherValue === 4
          ? 'Excelente evidencia: la decisión está claramente sustentada.'
          : teacherValue === 3
            ? 'Buen trabajo; conviene profundizar la justificación con un ejemplo adicional.'
            : 'Hace falta relacionar mejor la evidencia con la decisión final.'
        : '';
      valuation.confirmed = published;
      await this.valuations.save(valuation);
    }
  }

  private async ensureForumData(
    softwareClass: AcademicClass,
    databaseClass: AcademicClass,
    webClass: AcademicClass,
    teacher: User,
    student: User,
    student2: User,
    student3: User,
  ) {
    const guide = await this.ensureForumThread({
      academicClass: softwareClass,
      author: teacher,
      title: 'Guía y dudas frecuentes del proyecto final',
      description: 'Usen este hilo para centralizar dudas sobre alcance, evidencias esperadas y fecha de entrega del proyecto final.',
      pinned: true,
      resolved: false,
      createdDaysAgo: 8,
    });
    const guideQuestion = await this.ensureForumPost(
      guide,
      student2,
      '¿La bitácora debe incluir también las decisiones que descartamos durante las reuniones?',
      null,
      6,
    );
    await this.ensureForumPost(
      guide,
      teacher,
      'Sí. Incluyan la alternativa descartada, la evidencia revisada y el motivo de la decisión. Eso facilita evaluar el proceso.',
      guideQuestion,
      5,
    );
    await this.ensureForumPost(
      guide,
      student3,
      '¿Podemos adjuntar un enlace al repositorio además del documento final?',
      null,
      3,
    );

    const architecture = await this.ensureForumThread({
      academicClass: softwareClass,
      author: student,
      title: '¿Cómo documentar decisiones de arquitectura?',
      description: 'Tengo dudas sobre el nivel de detalle para explicar las alternativas que evaluamos antes de escoger la arquitectura modular.',
      pinned: false,
      resolved: false,
      createdDaysAgo: 3,
    });
    const teacherAnswer = await this.ensureForumPost(
      architecture,
      teacher,
      'Describe el contexto, las opciones consideradas y dos atributos de calidad afectados. No necesitas copiar todo el código.',
      null,
      2,
    );
    await this.ensureForumPost(
      architecture,
      student2,
      'A mí me ayudó usar una tabla breve con decisión, ventaja, riesgo y evidencia.',
      teacherAnswer,
      1,
    );

    const sources = await this.ensureForumThread({
      academicClass: softwareClass,
      author: student2,
      title: 'Fuentes para pruebas de accesibilidad',
      description: 'Comparto las referencias que usamos para validar contraste, navegación por teclado y mensajes de error.',
      pinned: false,
      resolved: true,
      createdDaysAgo: 12,
    });
    await this.ensureForumPost(
      sources,
      teacher,
      'Excelente aporte. Recuerden guardar capturas o resultados de las herramientas como evidencia de la validación.',
      null,
      11,
    );

    const sqlThread = await this.ensureForumThread({
      academicClass: databaseClass,
      author: student3,
      title: 'Duda con el plan de ejecución',
      description: 'La consulta usa el índice, pero el costo estimado sigue alto. ¿Qué métricas deberíamos comparar en el informe?',
      pinned: false,
      resolved: false,
      createdDaysAgo: 2,
    });
    await this.ensureForumPost(
      sqlThread,
      teacher,
      'Compara lecturas, tiempo total y cantidad de filas antes y después. Explica también el costo de mantener el índice.',
      null,
      1,
    );

    const webThread = await this.ensureForumThread({
      academicClass: webClass,
      author: teacher,
      title: 'Checklist para la demostración del prototipo',
      description: 'Antes de presentar, verifiquen el flujo principal, un caso de error, accesibilidad por teclado y comportamiento responsivo.',
      pinned: true,
      resolved: false,
      createdDaysAgo: 4,
    });
    await this.ensureForumPost(
      webThread,
      student,
      'Ya agregamos el caso de error de validación y una prueba desde móvil. Documentaremos ambos en la bitácora.',
      null,
      2,
    );

    return architecture;
  }

  private async ensureForumThread(seed: {
    academicClass: AcademicClass;
    author: User;
    title: string;
    description: string;
    pinned: boolean;
    resolved: boolean;
    createdDaysAgo: number;
  }) {
    let thread = await this.forumThreads.findOne({
      where: { academicClass: { id: seed.academicClass.id }, title: seed.title },
    });
    if (!thread) {
      thread = this.forumThreads.create({
        academicClass: seed.academicClass,
        author: seed.author,
        title: seed.title,
        description: seed.description,
        pinned: seed.pinned,
        resolved: seed.resolved,
      });
      thread.createdAt = this.dateAt(-seed.createdDaysAgo, 10);
    } else {
      thread.description = seed.description;
      thread.pinned = seed.pinned;
      thread.resolved = seed.resolved;
    }
    return this.forumThreads.save(thread);
  }

  private async ensureForumPost(
    thread: ForumThread,
    author: User,
    body: string,
    parentPost: ForumPost | null,
    createdDaysAgo: number,
  ) {
    const existing = await this.forumPosts.findOne({
      where: { thread: { id: thread.id }, body },
    });
    if (existing) return existing;
    const post = this.forumPosts.create({ thread, author, body, parentPost });
    post.createdAt = this.dateAt(-createdDaysAgo, 14);
    return this.forumPosts.save(post);
  }

  private async ensureDemoNotifications(
    student: User,
    academicClass: AcademicClass,
    forumThread: ForumThread,
    activities: Map<string, Activity>,
  ) {
    const debate = activities.get('Debate ético — autos autónomos');
    const privacy = activities.get('Ensayo sobre privacidad de datos');
    if (!debate || !privacy) return;
    await this.upsertNotification(student, {
      type: NotificationType.GRADE_PUBLISHED,
      title: `Tu entrega de “${debate.title}” ha sido calificada`,
      message: 'El docente publicó tu nota y dejó retroalimentación por criterio.',
      read: false,
      activityId: debate.id,
      forumThreadId: null,
      classId: null,
      daysAgo: 2,
    });
    await this.upsertNotification(student, {
      type: NotificationType.FORUM_REPLY,
      title: 'Nueva respuesta de Carlos Torres',
      message: `Respondieron al hilo “${forumThread.title}”.`,
      read: false,
      activityId: null,
      forumThreadId: forumThread.id,
      classId: academicClass.id,
      daysAgo: 1,
    });
    await this.upsertNotification(student, {
      type: NotificationType.GRADE_PUBLISHED,
      title: `Tu entrega de “${privacy.title}” ha sido calificada`,
      message: 'El docente publicó tu nota del ensayo de privacidad.',
      read: true,
      activityId: privacy.id,
      forumThreadId: null,
      classId: null,
      daysAgo: 12,
    });
  }

  private async upsertNotification(
    student: User,
    seed: {
      type: NotificationType;
      title: string;
      message: string;
      read: boolean;
      activityId: number | null;
      forumThreadId: number | null;
      classId: number | null;
      daysAgo: number;
    },
  ) {
    let notification = await this.notifications.findOne({
      where: { user: { id: student.id }, title: seed.title },
    });
    if (!notification) notification = this.notifications.create({ user: student });
    notification.type = seed.type;
    notification.title = seed.title;
    notification.message = seed.message;
    notification.read = seed.read;
    notification.activityId = seed.activityId;
    notification.forumThreadId = seed.forumThreadId;
    notification.classId = seed.classId;
    notification.createdAt = this.dateAt(-seed.daysAgo, 16);
    return this.notifications.save(notification);
  }

  private async ensureClass(seed: {
    name: string;
    subject: string;
    code: string;
    period: string;
    teacher: User;
  }) {
    let academicClass = await this.classes.findOne({ where: { code: seed.code } });
    if (!academicClass) academicClass = this.classes.create(seed);
    academicClass.name = seed.name;
    academicClass.subject = seed.subject;
    academicClass.period = seed.period;
    academicClass.teacher = seed.teacher;
    return this.classes.save(academicClass);
  }

  private async ensureEnrollment(student: User, academicClass: AcademicClass) {
    const existing = await this.enrollments.findOne({
      where: { student: { id: student.id }, academicClass: { id: academicClass.id } },
    });
    if (!existing) {
      return this.enrollments.save(
        this.enrollments.create({ student, academicClass, active: true }),
      );
    }
    if (!existing.active) {
      existing.active = true;
      return this.enrollments.save(existing);
    }
    return existing;
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
    } else if (user.name !== name || user.role !== role || !user.active) {
      user.name = name;
      user.role = role;
      user.active = true;
      user = await this.users.save(user);
    }
    return user;
  }

  private dateOnly(daysFromToday: number) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + daysFromToday);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private dateAt(daysFromToday: number, hour: number) {
    const date = new Date();
    date.setHours(hour, 0, 0, 0);
    date.setDate(date.getDate() + daysFromToday);
    return date;
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
