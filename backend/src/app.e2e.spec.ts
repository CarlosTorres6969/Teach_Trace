import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { AddressInfo } from 'net';
import { DataSource } from 'typeorm';
import { configureApp } from './app.setup';
import { Activity, ActivityPhase } from './entities/activity.entity';
import { AiDeclaration } from './entities/ai-declaration.entity';
import { AcademicClass } from './entities/class.entity';
import { Enrollment } from './entities/enrollment.entity';
import { Indicator } from './entities/indicator.entity';
import { Logbook } from './entities/logbook.entity';
import { Submission, EvaluationStatus } from './entities/submission.entity';
import { User, UserRole } from './entities/user.entity';
import { Valuation } from './entities/valuation.entity';

jest.setTimeout(180000);

type LoginResponse = {
  accessToken: string;
  user: { id: number; role: UserRole };
};

describe('TeachTrace API (integración)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let baseUrl: string;
  let teacher: LoginResponse;
  let student: LoginResponse;
  let classId: number;
  let activityId: number;
  let submissionId: number;

  const previousEnvironment = {
    databasePath: process.env.DATABASE_PATH,
    databaseAutosave: process.env.DATABASE_AUTOSAVE,
    databaseSynchronize: process.env.DATABASE_SYNCHRONIZE,
    demoSeed: process.env.DEMO_SEED,
    jwtSecret: process.env.JWT_SECRET,
  };

  async function request(path: string, init: RequestInit = {}) {
    const response = await fetch(`${baseUrl}${path}`, init);
    const text = await response.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    return { response, body };
  }

  function authorization(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  beforeAll(async () => {
    process.env.DATABASE_PATH = ':memory:';
    process.env.DATABASE_AUTOSAVE = 'false';
    process.env.DATABASE_SYNCHRONIZE = 'true';
    process.env.DEMO_SEED = 'true';
    process.env.JWT_SECRET = 'clave-exclusiva-para-pruebas-de-integracion';

    const { AppModule } = await import('./app.module');
    app = await NestFactory.create(AppModule, { logger: false });
    configureApp(app, app.get(ConfigService));
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
    dataSource = app.get(DataSource);

    const teacherLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'docente@unah.edu.hn', password: 'Docente123!' }),
    });
    const studentLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'estudiante@unah.edu.hn', password: 'Estudiante123!' }),
    });
    teacher = teacherLogin.body as LoginResponse;
    student = studentLogin.body as LoginResponse;

    const classes = await request('/api/teacher/classes', {
      headers: authorization(teacher.accessToken),
    });
    classId = (classes.body as Array<{ id: number }>)[0].id;
    const activities = await request('/api/teacher/activities', {
      headers: authorization(teacher.accessToken),
    });
    activityId = (activities.body as Array<{ id: number }>)[0].id;
  });

  afterAll(async () => {
    await app?.close();
    const restore = (key: string, value: string | undefined) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    };
    restore('DATABASE_PATH', previousEnvironment.databasePath);
    restore('DATABASE_AUTOSAVE', previousEnvironment.databaseAutosave);
    restore('DATABASE_SYNCHRONIZE', previousEnvironment.databaseSynchronize);
    restore('DEMO_SEED', previousEnvironment.demoSeed);
    restore('JWT_SECRET', previousEnvironment.jwtSecret);
  });

  it('R4: protege endpoints y separa los roles en la API real', async () => {
    const anonymous = await request('/api/student/activities');
    expect(anonymous.response.status).toBe(401);

    const studentOnTeacherRoute = await request('/api/teacher/classes', {
      headers: authorization(student.accessToken),
    });
    expect(studentOnTeacherRoute.response.status).toBe(403);

    const invalidPhase = await request('/api/teacher/activities', {
      method: 'POST',
      headers: {
        ...authorization(teacher.accessToken),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Actividad inválida',
        classId,
        dueDate: '2026-10-01',
        activityType: 'Ensayo',
        evaluationPhase: 'otra',
      }),
    });
    expect(invalidPhase.response.status).toBe(400);
  });

  it('ejecuta el flujo base con matrícula, siete dimensiones, bitácora, declaración y archivo', async () => {
    const teacherActivities = await request('/api/teacher/activities', {
      headers: authorization(teacher.accessToken),
    });
    const configuredActivity = (teacherActivities.body as Array<{
      id: number;
      evaluationPhase: ActivityPhase;
      rubric: { criteria: unknown[] };
    }>)[0];
    expect(configuredActivity.evaluationPhase).toBe(ActivityPhase.PILOT);
    expect(configuredActivity.rubric.criteria).toHaveLength(7);

    const studentActivities = await request('/api/student/activities', {
      headers: authorization(student.accessToken),
    });
    expect((studentActivities.body as unknown[])).toHaveLength(1);

    const logbook = await request(`/api/student/activities/${activityId}/logbook`, {
      method: 'PUT',
      headers: {
        ...authorization(student.accessToken),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        initialIdeas: 'Ideas propias del estudiante autenticado',
        prompts: 'Prompt de contraste',
        validationsAndDecisions: 'Validó las fuentes antes de decidir',
        finalReflection: 'Reflexión final',
      }),
    });
    expect(logbook.response.status).toBe(200);

    const form = new FormData();
    form.set('productText', 'Producto académico integrado');
    form.set('productUrl', '');
    form.set('toolName', 'ChatGPT');
    form.set('usageLevel', '2');
    form.set('purpose', 'Contrastar argumentos');
    form.set('promptSummary', 'Consultas para contrastar');
    form.set('file', new Blob(['evidencia académica'], { type: 'text/plain' }), 'evidencia.txt');
    const submitted = await request(`/api/student/activities/${activityId}/submission`, {
      method: 'PUT',
      headers: authorization(student.accessToken),
      body: form,
    });
    expect(submitted.response.status).toBe(200);

    const submissions = await request(`/api/teacher/activities/${activityId}/submissions`, {
      headers: authorization(teacher.accessToken),
    });
    submissionId = (submissions.body as Array<{ id: number }>)[0].id;
    const detail = await request(`/api/teacher/submissions/${submissionId}`, {
      headers: authorization(teacher.accessToken),
    });
    expect(detail.body).toMatchObject({
      fileName: 'evidencia.txt',
      aiDeclaration: { toolName: 'ChatGPT', usageLevel: 2 },
    });

    const downloaded = await request(`/api/teacher/submissions/${submissionId}/file`, {
      headers: authorization(teacher.accessToken),
    });
    expect(downloaded.response.status).toBe(200);
    expect(downloaded.body).toBe('evidencia académica');

    const studentDownload = await request(`/api/teacher/submissions/${submissionId}/file`, {
      headers: authorization(student.accessToken),
    });
    expect(studentDownload.response.status).toBe(403);
  });

  it('R1: persiste la degradación manual cuando el motor todavía no está disponible', async () => {
    const evaluation = await request(`/api/entregas/actividad/${activityId}/evaluar`, {
      method: 'POST',
      headers: authorization(teacher.accessToken),
    });
    expect(evaluation.body).toMatchObject({
      processed: 1,
      valuationsCreated: 0,
      pendingManualReview: 1,
      implemented: false,
    });

    const submission = await dataSource.getRepository(Submission).findOneByOrFail({ id: submissionId });
    expect(submission.evaluationStatus).toBe(EvaluationStatus.MANUAL_REQUIRED);
    expect(submission.manualReviewRequired).toBe(true);
    const activity = await dataSource.getRepository(Activity).findOneByOrFail({ id: activityId });
    expect(activity.manualEvaluationRequired).toBe(true);
  });

  it('impide leer la bitácora de otro estudiante incluso conociendo su id', async () => {
    const users = dataSource.getRepository(User);
    const classes = dataSource.getRepository(AcademicClass);
    const enrollments = dataSource.getRepository(Enrollment);
    const logbooks = dataSource.getRepository(Logbook);
    const activities = dataSource.getRepository(Activity);
    const otherStudent = await users.save(
      users.create({
        email: 'otro.estudiante@unah.edu.hn',
        name: 'Otro estudiante',
        passwordHash: 'no-utilizada-en-esta-prueba',
        role: UserRole.STUDENT,
        active: true,
      }),
    );
    const academicClass = await classes.findOneByOrFail({ id: classId });
    await enrollments.save(
      enrollments.create({ student: otherStudent, academicClass, active: true }),
    );
    const activity = await activities.findOneByOrFail({ id: activityId });
    const otherLogbook = await logbooks.save(
      logbooks.create({
        student: otherStudent,
        activity,
        initialIdeas: 'Contenido secreto de otro estudiante',
        prompts: '',
        validationsAndDecisions: '',
        finalReflection: '',
      }),
    );

    const ownLogbook = await request(`/api/student/activities/${activityId}/logbook`, {
      headers: authorization(student.accessToken),
    });
    expect(ownLogbook.body).toMatchObject({
      initialIdeas: 'Ideas propias del estudiante autenticado',
    });
    expect(JSON.stringify(ownLogbook.body)).not.toContain('Contenido secreto');

    const attemptByKnownId = await request(
      `/api/student/activities/${otherLogbook.id}/logbook`,
      { headers: authorization(student.accessToken) },
    );
    expect(attemptByKnownId.response.status).toBe(404);
  });

  it('R2/R3: conserva separados los valores IA-docente y la referencia de línea base', async () => {
    const activities = dataSource.getRepository(Activity);
    const submissions = dataSource.getRepository(Submission);
    const valuations = dataSource.getRepository(Valuation);
    const indicators = dataSource.getRepository(Indicator);
    const activity = await activities.findOneByOrFail({ id: activityId });
    const submission = await submissions.findOneByOrFail({ id: submissionId });
    let valuation = await valuations.save(
      valuations.create({
        activity,
        submission,
        criterion: 'Calidad de la argumentación',
        dimension: 'Argumentación',
        aiValue: 3,
        aiExplanation: 'Evidencia identificada por la IA',
        teacherValue: null,
        teacherComment: '',
        confirmed: false,
      }),
    );
    valuation.teacherValue = 4;
    valuation.teacherComment = 'Ajuste docente sustentado';
    valuation = await valuations.save(valuation);
    expect(valuation.aiValue).toBe(3);
    expect(valuation.teacherValue).toBe(4);

    const invalidValuation = valuations.create({
      activity,
      submission,
      criterion: 'Otro criterio',
      dimension: 'Comprensión',
      aiValue: 5,
      aiExplanation: 'Inválida',
      teacherValue: null,
      teacherComment: '',
      confirmed: false,
    });
    await expect(valuations.save(invalidValuation)).rejects.toThrow();

    const indicator = await indicators.save(
      indicators.create({
        type: 'trazabilidad_proceso',
        value: 82.5,
        baselineValue: 61.5,
        baselineReference: 'Fase 0 — línea base interna',
      }),
    );
    expect(indicator.baselineValue).toBe(61.5);
    expect(indicator.baselineReference).toContain('línea base');

    const relation = dataSource
      .getMetadata(Activity)
      .relations.find((candidate) => candidate.propertyName === 'academicClass');
    expect(relation?.isNullable).toBe(false);
  });

  it('rechaza en SQLite niveles de IA fuera del rango establecido', async () => {
    const declarations = dataSource.getRepository(AiDeclaration);
    const declaration = await declarations.findOneByOrFail({
      student: { id: student.user.id },
      activity: { id: activityId },
    });
    declaration.usageLevel = 4;
    await expect(declarations.save(declaration)).rejects.toThrow();

    declaration.usageLevel = 2;
    declaration.detectedUsageLevel = 3;
    const saved = await declarations.save(declaration);
    expect(saved.usageDiscrepancy).toBe(true);
  });
});
