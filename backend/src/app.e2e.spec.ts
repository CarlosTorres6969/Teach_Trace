import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { AddressInfo } from 'net';
import { DataSource } from 'typeorm';
import { configureApp } from './app.setup';
import { AuthService } from './auth/auth.service';
import { Activity, ActivityPhase } from './entities/activity.entity';
import { AiDeclaration } from './entities/ai-declaration.entity';
import { AuthSession } from './entities/auth-session.entity';
import { AcademicClass } from './entities/class.entity';
import { Enrollment } from './entities/enrollment.entity';
import { Indicator } from './entities/indicator.entity';
import { Logbook } from './entities/logbook.entity';
import { Submission, EvaluationStatus } from './entities/submission.entity';
import { User, UserRole } from './entities/user.entity';
import { Valuation } from './entities/valuation.entity';

jest.setTimeout(180000);

type LoginResponse = {
  sessionCookie: string;
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

  function sessionHeaders(cookie: string) {
    return { Cookie: cookie };
  }

  function readSessionCookie(response: Response) {
    const cookie = response.headers.get('set-cookie');
    if (!cookie) throw new Error('El login no devolvió la cookie de sesión');
    return cookie.split(';')[0];
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
    teacher = {
      ...(teacherLogin.body as Omit<LoginResponse, 'sessionCookie'>),
      sessionCookie: readSessionCookie(teacherLogin.response),
    };
    student = {
      ...(studentLogin.body as Omit<LoginResponse, 'sessionCookie'>),
      sessionCookie: readSessionCookie(studentLogin.response),
    };

    const classes = await request('/api/teacher/classes', {
      headers: sessionHeaders(teacher.sessionCookie),
    });
    classId = (classes.body as Array<{ id: number }>)[0].id;
    const activities = await request('/api/teacher/activities', {
      headers: sessionHeaders(teacher.sessionCookie),
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
      headers: sessionHeaders(student.sessionCookie),
    });
    expect(studentOnTeacherRoute.response.status).toBe(403);

    const invalidPhase = await request('/api/teacher/activities', {
      method: 'POST',
      headers: {
        ...sessionHeaders(teacher.sessionCookie),
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

  it('entrega la sesión web en una cookie HttpOnly sin exponer el JWT en el cuerpo', async () => {
    const login = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'docente@unah.edu.hn', password: 'Docente123!' }),
    });

    expect(login.response.status).toBe(201);
    expect(login.body).not.toHaveProperty('accessToken');
    expect(login.response.headers.get('set-cookie')).toEqual(
      expect.stringContaining('teachtrace_session='),
    );
    expect(login.response.headers.get('set-cookie')).toEqual(expect.stringContaining('HttpOnly'));
    expect(login.response.headers.get('set-cookie')).toEqual(
      expect.stringContaining('SameSite=Strict'),
    );
    expect(login.response.headers.get('set-cookie')).toEqual(expect.stringContaining('Path=/api'));
  });

  it('rechaza el inicio de sesión de un docente inactivo', async () => {
    const users = dataSource.getRepository(User);
    const authService = app.get(AuthService);
    await users.save(
      users.create({
        email: 'docente.inactivo@unah.edu.hn',
        name: 'Docente inactivo',
        passwordHash: await authService.hashPassword('DocenteInactivo123!'),
        role: UserRole.TEACHER,
        active: false,
      }),
    );

    const login = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'docente.inactivo@unah.edu.hn',
        password: 'DocenteInactivo123!',
      }),
    });
    expect(login.response.status).toBe(401);
  });

  it('rechaza y elimina la cookie de una sesión expirada', async () => {
    const login = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'docente@unah.edu.hn', password: 'Docente123!' }),
    });
    const cookie = readSessionCookie(login.response);
    const token = decodeURIComponent(cookie.slice(cookie.indexOf('=') + 1));
    const payload = await app.get(JwtService).verifyAsync<{ sid: string }>(token);
    await dataSource
      .getRepository(AuthSession)
      .update(payload.sid, { expiresAt: new Date(Date.now() - 1000) });

    const me = await request('/api/auth/me', { headers: sessionHeaders(cookie) });
    expect(me.response.status).toBe(401);
    expect(me.response.headers.get('set-cookie')).toEqual(
      expect.stringContaining('teachtrace_session='),
    );
  });

  it('limita ataques repetidos y responde 429 con Retry-After', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const invalid = await request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'ataque@unah.edu.hn', password: 'Incorrecta123!' }),
      });
      expect(invalid.response.status).toBe(401);
    }

    const blocked = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ataque@unah.edu.hn', password: 'Incorrecta123!' }),
    });
    expect(blocked.response.status).toBe(429);
    expect(Number(blocked.response.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('matricula estudiantes en lote con deduplicación, reporte y control de acceso', async () => {
    const users = dataSource.getRepository(User);
    await users.save(
      users.create({
        email: 'estudiante.lote@unah.edu.hn',
        name: 'Estudiante de lote',
        passwordHash: 'no-utilizada-en-esta-prueba',
        role: UserRole.STUDENT,
        active: true,
      }),
    );
    const endpoint = `/api/teacher/classes/${classId}/enrollments/bulk`;
    const imported = await request(endpoint, {
      method: 'POST',
      headers: {
        ...sessionHeaders(teacher.sessionCookie),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        emails: [
          ' ESTUDIANTE.LOTE@UNAH.EDU.HN ',
          'estudiante.lote@unah.edu.hn',
          'estudiante@unah.edu.hn',
          'cuenta.inexistente@unah.edu.hn',
        ],
      }),
    });

    expect(imported.response.status).toBe(201);
    expect(imported.body).toEqual({
      processedCount: 3,
      enrolledCount: 1,
      alreadyEnrolledCount: 1,
      notFoundEmails: ['cuenta.inexistente@unah.edu.hn'],
    });

    const listed = await request('/api/teacher/classes', {
      headers: sessionHeaders(teacher.sessionCookie),
    });
    const updatedClass = (listed.body as Array<{
      id: number;
      students: Array<{ email: string }>;
    }>).find((academicClass) => academicClass.id === classId);
    expect(updatedClass?.students).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ email: 'estudiante.lote@unah.edu.hn' }),
      ]),
    );

    for (const emails of [[], Array.from({ length: 501 }, (_, index) => `lote${index}@unah.edu.hn`)]) {
      const invalid = await request(endpoint, {
        method: 'POST',
        headers: {
          ...sessionHeaders(teacher.sessionCookie),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emails }),
      });
      expect(invalid.response.status).toBe(400);
    }

    const studentAttempt = await request(endpoint, {
      method: 'POST',
      headers: {
        ...sessionHeaders(student.sessionCookie),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ emails: ['estudiante.lote@unah.edu.hn'] }),
    });
    expect(studentAttempt.response.status).toBe(403);

    const anonymousAttempt = await request(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails: ['estudiante.lote@unah.edu.hn'] }),
    });
    expect(anonymousAttempt.response.status).toBe(401);
  });

  it('asocia resultados de aprendizaje con validación, persistencia y permisos', async () => {
    const endpoint = `/api/teacher/activities/${activityId}/learning-outcomes`;
    const update = await request(endpoint, {
      method: 'PUT',
      headers: {
        ...sessionHeaders(teacher.sessionCookie),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        learningOutcomes: ['  Analiza evidencia académica  ', 'Argumenta decisiones'],
      }),
    });
    expect(update.response.status).toBe(200);
    expect(update.body).toMatchObject({
      learningOutcomes: ['Analiza evidencia académica', 'Argumenta decisiones'],
    });

    const persisted = await request('/api/teacher/activities', {
      headers: sessionHeaders(teacher.sessionCookie),
    });
    const persistedActivity = (persisted.body as Array<{ id: number; learningOutcomes: string[] }>).find(
      (activity) => activity.id === activityId,
    );
    expect(persistedActivity?.learningOutcomes).toEqual([
      'Analiza evidencia académica',
      'Argumenta decisiones',
    ]);

    for (const learningOutcomes of [
      [],
      ['   '],
      Array.from({ length: 21 }, (_, index) => `Resultado ${index}`),
      ['a'.repeat(501)],
    ]) {
      const invalid = await request(endpoint, {
        method: 'PUT',
        headers: {
          ...sessionHeaders(teacher.sessionCookie),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ learningOutcomes }),
      });
      expect(invalid.response.status).toBe(400);
    }

    const maximum = await request(endpoint, {
      method: 'PUT',
      headers: {
        ...sessionHeaders(teacher.sessionCookie),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ learningOutcomes: ['a'.repeat(500)] }),
    });
    expect(maximum.response.status).toBe(200);

    const users = dataSource.getRepository(User);
    const authService = app.get(AuthService);
    await users.save(
      users.create({
        email: 'otro.docente.resultados@unah.edu.hn',
        name: 'Otro docente',
        passwordHash: await authService.hashPassword('OtroDocente123!'),
        role: UserRole.TEACHER,
        active: true,
      }),
    );
    const otherTeacherLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'otro.docente.resultados@unah.edu.hn',
        password: 'OtroDocente123!',
      }),
    });
    const otherTeacherCookie = readSessionCookie(otherTeacherLogin.response);
    const otherTeacher = await request(endpoint, {
      method: 'PUT',
      headers: {
        ...sessionHeaders(otherTeacherCookie),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ learningOutcomes: ['Intento no autorizado'] }),
    });
    expect(otherTeacher.response.status).toBe(404);

    const studentAttempt = await request(endpoint, {
      method: 'PUT',
      headers: {
        ...sessionHeaders(student.sessionCookie),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ learningOutcomes: ['Intento de estudiante'] }),
    });
    expect(studentAttempt.response.status).toBe(403);

    const anonymousAttempt = await request(endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ learningOutcomes: ['Intento anónimo'] }),
    });
    expect(anonymousAttempt.response.status).toBe(401);
  });

  it('crea y normaliza rúbricas válidas y rechaza estructuras inválidas o no autorizadas', async () => {
    const endpoint = '/api/teacher/rubrics';
    const criteria = () =>
      Array.from({ length: 7 }, (_, index) => ({
        name: `  Criterio QA ${index + 1}  `,
        dimension: `  Dimensión QA ${index + 1}  `,
        descriptors: {
          level1: '  Nivel inicial  ',
          level2: '  Nivel básico  ',
          level3: '  Nivel competente  ',
          level4: '  Nivel avanzado  ',
        },
      }));
    const validInput = { name: '  Rúbrica de validación QA  ', criteria: criteria() };
    const create = (body: unknown, cookie = teacher.sessionCookie) =>
      request(endpoint, {
        method: 'POST',
        headers: { ...sessionHeaders(cookie), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

    const created = await create(validInput);
    expect(created.response.status).toBe(201);
    expect(created.body).toEqual(expect.objectContaining({
      name: 'Rúbrica de validación QA',
      criteria: expect.arrayContaining([
        {
          name: 'Criterio QA 1',
          dimension: 'Dimensión QA 1',
          descriptors: {
            level1: 'Nivel inicial',
            level2: 'Nivel básico',
            level3: 'Nivel competente',
            level4: 'Nivel avanzado',
          },
        },
      ]),
    }));

    const persisted = await request(endpoint, {
      headers: sessionHeaders(teacher.sessionCookie),
    });
    const persistedRubric = (persisted.body as Array<{
      id: number;
      name: string;
      criteria: Array<{ name: string; dimension: string }>;
    }>).find((rubric) => rubric.id === (created.body as { id: number }).id);
    expect(persistedRubric).toEqual(expect.objectContaining({
      name: 'Rúbrica de validación QA',
      criteria: expect.arrayContaining([
        expect.objectContaining({ name: 'Criterio QA 1', dimension: 'Dimensión QA 1' }),
      ]),
    }));

    const eightCriteria = { name: 'Ocho dimensiones', criteria: [...criteria(), {
      name: 'Criterio adicional',
      dimension: 'Dimensión adicional',
      descriptors: {
        level1: 'Inicial', level2: 'Básico', level3: 'Competente', level4: 'Avanzado',
      },
    }] };
    const duplicateDimension = { name: 'Dimensión duplicada', criteria: criteria() };
    duplicateDimension.criteria[1].dimension = '  DIMENSIÓN QA 1  ';
    const duplicateCriterion = { name: 'Criterio duplicado', criteria: criteria() };
    duplicateCriterion.criteria[1].name = '  CRITERIO QA 1  ';
    const whitespaceOnly = {
      name: '   ',
      criteria: Array.from({ length: 7 }, () => ({
        name: '   ',
        dimension: '   ',
        descriptors: { level1: '   ', level2: '   ', level3: '   ', level4: '   ' },
      })),
    };
    const missingDescriptor = { name: 'Descriptor faltante', criteria: criteria() };
    delete (missingDescriptor.criteria[0].descriptors as { level4?: string }).level4;
    const longDescriptor = { name: 'Descriptor extenso', criteria: criteria() };
    longDescriptor.criteria[0].descriptors.level1 = 'a'.repeat(1001);
    const duplicateDescriptors = { name: 'Descriptores duplicados', criteria: criteria() };
    duplicateDescriptors.criteria[0].descriptors.level2 = '  NIVEL INICIAL  ';
    const incorrectDescriptorType = { name: 'Descriptor con tipo inválido', criteria: criteria() };
    (incorrectDescriptorType.criteria[0].descriptors as unknown as Record<string, unknown>).level1 = 1;
    const additionalLevel = { name: 'Nivel adicional', criteria: criteria() };
    (additionalLevel.criteria[0].descriptors as unknown as Record<string, unknown>).level5 =
      'Nivel no permitido';

    for (const invalidInput of [
      eightCriteria,
      duplicateDimension,
      duplicateCriterion,
      whitespaceOnly,
      missingDescriptor,
      longDescriptor,
      duplicateDescriptors,
      incorrectDescriptorType,
      additionalLevel,
    ]) {
      expect((await create(invalidInput)).response.status).toBe(400);
    }

    expect((await create(validInput, student.sessionCookie)).response.status).toBe(403);
    expect((await create(validInput, '')).response.status).toBe(401);
  });

  it('asocia, sustituye y protege la reutilización de rúbricas mediante el endpoint real', async () => {
    const criteria = (prefix: string) =>
      Array.from({ length: 7 }, (_, index) => ({
        name: `${prefix} criterio ${index + 1}`,
        dimension: `${prefix} dimensión ${index + 1}`,
        descriptors: {
          level1: 'Nivel inicial',
          level2: 'Nivel básico',
          level3: 'Nivel competente',
          level4: 'Nivel avanzado',
        },
      }));
    const createActivity = async (cookie: string, ownedClassId: number, title: string) =>
      request('/api/teacher/activities', {
        method: 'POST',
        headers: { ...sessionHeaders(cookie), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          classId: ownedClassId,
          dueDate: '2026-12-15',
          activityType: 'Proyecto',
          evaluationPhase: 'pilot',
        }),
      });
    const createRubric = async (cookie: string, name: string) =>
      request('/api/teacher/rubrics', {
        method: 'POST',
        headers: { ...sessionHeaders(cookie), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, criteria: criteria(name) }),
      });
    const associate = (cookie: string, targetActivityId: number | string, rubricId: unknown) =>
      request(`/api/teacher/activities/${targetActivityId}/rubric`, {
        method: 'PUT',
        headers: { ...sessionHeaders(cookie), 'Content-Type': 'application/json' },
        body: JSON.stringify({ rubricId }),
      });

    const firstActivity = await createActivity(teacher.sessionCookie, classId, 'Actividad con rúbrica');
    const secondActivity = await createActivity(
      teacher.sessionCookie,
      classId,
      'Actividad para comprobar reutilización',
    );
    const firstRubric = await createRubric(teacher.sessionCookie, 'Rúbrica asociable A');
    const replacementRubric = await createRubric(teacher.sessionCookie, 'Rúbrica asociable B');
    const firstActivityId = (firstActivity.body as { id: number }).id;
    const secondActivityId = (secondActivity.body as { id: number }).id;
    const firstRubricId = (firstRubric.body as { id: number }).id;
    const replacementRubricId = (replacementRubric.body as { id: number }).id;

    const validAssociation = await associate(
      teacher.sessionCookie,
      firstActivityId,
      firstRubricId,
    );
    expect(validAssociation.response.status).toBe(200);
    expect(validAssociation.body).toMatchObject({ rubric: { id: firstRubricId } });

    const idempotentAssociation = await associate(
      teacher.sessionCookie,
      firstActivityId,
      firstRubricId,
    );
    expect(idempotentAssociation.response.status).toBe(200);

    const persisted = await request('/api/teacher/activities', {
      headers: sessionHeaders(teacher.sessionCookie),
    });
    expect(
      (persisted.body as Array<{ id: number; rubric: { id: number } | null }>).find(
        (item) => item.id === firstActivityId,
      )?.rubric?.id,
    ).toBe(firstRubricId);

    const replacement = await associate(
      teacher.sessionCookie,
      firstActivityId,
      replacementRubricId,
    );
    expect(replacement.response.status).toBe(200);
    expect(replacement.body).toMatchObject({ rubric: { id: replacementRubricId } });

    const listedRubrics = await request('/api/teacher/rubrics', {
      headers: sessionHeaders(teacher.sessionCookie),
    });
    const rubricAssociations = listedRubrics.body as Array<{ id: number; activityId: number | null }>;
    expect(rubricAssociations.find((item) => item.id === firstRubricId)?.activityId).toBeNull();
    expect(rubricAssociations.find((item) => item.id === replacementRubricId)?.activityId).toBe(
      firstActivityId,
    );

    const reused = await associate(
      teacher.sessionCookie,
      secondActivityId,
      replacementRubricId,
    );
    expect(reused.response.status).toBe(409);
    const afterConflict = await request('/api/teacher/activities', {
      headers: sessionHeaders(teacher.sessionCookie),
    });
    const activitiesAfterConflict = afterConflict.body as Array<{
      id: number;
      rubric: { id: number } | null;
    }>;
    expect(activitiesAfterConflict.find((item) => item.id === firstActivityId)?.rubric?.id).toBe(
      replacementRubricId,
    );
    expect(activitiesAfterConflict.find((item) => item.id === secondActivityId)?.rubric).toBeNull();

    expect((await associate(teacher.sessionCookie, 'invalida', firstRubricId)).response.status).toBe(
      400,
    );
    for (const invalidRubricId of [0, -1, 1.5, '1']) {
      expect(
        (await associate(teacher.sessionCookie, secondActivityId, invalidRubricId)).response.status,
      ).toBe(400);
    }

    const users = dataSource.getRepository(User);
    const authService = app.get(AuthService);
    await users.save(
      users.create({
        email: 'docente.ajeno.rubricas@unah.edu.hn',
        name: 'Docente ajeno de rúbricas',
        passwordHash: await authService.hashPassword('DocenteAjeno123!'),
        role: UserRole.TEACHER,
        active: true,
      }),
    );
    const otherLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'docente.ajeno.rubricas@unah.edu.hn',
        password: 'DocenteAjeno123!',
      }),
    });
    const otherCookie = readSessionCookie(otherLogin.response);
    const otherClass = await request('/api/teacher/classes', {
      method: 'POST',
      headers: { ...sessionHeaders(otherCookie), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Clase de otro docente',
        subject: 'Asignatura ajena',
        code: 'AJ-01',
        period: '2026-III',
      }),
    });
    const otherActivity = await createActivity(
      otherCookie,
      (otherClass.body as { id: number }).id,
      'Actividad ajena',
    );
    const otherRubric = await createRubric(otherCookie, 'Rúbrica ajena');

    expect(
      (
        await associate(
          teacher.sessionCookie,
          (otherActivity.body as { id: number }).id,
          firstRubricId,
        )
      ).response.status,
    ).toBe(404);
    expect(
      (
        await associate(
          teacher.sessionCookie,
          secondActivityId,
          (otherRubric.body as { id: number }).id,
        )
      ).response.status,
    ).toBe(404);

    expect((await associate(student.sessionCookie, secondActivityId, firstRubricId)).response.status).toBe(
      403,
    );
    expect((await associate('', secondActivityId, firstRubricId)).response.status).toBe(401);
  });

  it('valida, normaliza y persiste el nombre de la herramienta de IA', async () => {
    const draftActivity = await request('/api/teacher/activities', {
      method: 'POST',
      headers: { ...sessionHeaders(teacher.sessionCookie), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Actividad para declaración en borrador',
        classId,
        dueDate: '2026-12-20',
        activityType: 'Ensayo',
        evaluationPhase: 'pilot',
      }),
    });
    expect(draftActivity.response.status).toBe(201);
    const draftActivityId = (draftActivity.body as { id: number }).id;
    const endpoint = `/api/student/activities/${draftActivityId}/ai-declaration`;
    const validDeclaration = {
      toolName: '  Claude  ',
      usageLevel: 2,
      purpose: '  Contrastar fuentes  ',
      promptSummary: '  Comparar argumentos  ',
    };

    const updated = await request(endpoint, {
      method: 'PUT',
      headers: { ...sessionHeaders(student.sessionCookie), 'Content-Type': 'application/json' },
      body: JSON.stringify(validDeclaration),
    });
    expect(updated.response.status).toBe(200);
    expect(updated.body).toMatchObject({
      toolName: 'Claude',
      purpose: 'Contrastar fuentes',
      promptSummary: 'Comparar argumentos',
    });

    for (const toolName of ['', '   ', 'a'.repeat(121), 42]) {
      const invalid = await request(endpoint, {
        method: 'PUT',
        headers: { ...sessionHeaders(student.sessionCookie), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validDeclaration, toolName }),
      });
      expect(invalid.response.status).toBe(400);
    }

    const missing = await request(endpoint, {
      method: 'PUT',
      headers: { ...sessionHeaders(student.sessionCookie), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usageLevel: 2,
        purpose: 'Contrastar fuentes',
        promptSummary: 'Comparar argumentos',
      }),
    });
    expect(missing.response.status).toBe(400);

    const invalidSubmission = new FormData();
    invalidSubmission.set('productText', 'Producto sin herramienta declarada');
    invalidSubmission.set('productUrl', '');
    invalidSubmission.set('toolName', '   ');
    invalidSubmission.set('usageLevel', '2');
    invalidSubmission.set('purpose', 'Contrastar fuentes');
    invalidSubmission.set('promptSummary', 'Comparar argumentos');
    const rejectedSubmission = await request(
      `/api/student/activities/${draftActivityId}/submission`,
      {
        method: 'PUT',
        headers: sessionHeaders(student.sessionCookie),
        body: invalidSubmission,
      },
    );
    expect(rejectedSubmission.response.status).toBe(400);

    const teacherAttempt = await request(endpoint, {
      method: 'PUT',
      headers: { ...sessionHeaders(teacher.sessionCookie), 'Content-Type': 'application/json' },
      body: JSON.stringify(validDeclaration),
    });
    expect(teacherAttempt.response.status).toBe(403);
    const anonymousAttempt = await request(endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validDeclaration),
    });
    expect(anonymousAttempt.response.status).toBe(401);

    const persisted = await dataSource.getRepository(AiDeclaration).findOneOrFail({
      where: { student: { id: student.user.id }, activity: { id: draftActivityId } },
    });
    expect(persisted.toolName).toBe('Claude');
  });

  it('exige y persiste un nivel declarado válido sin coerciones inseguras', async () => {
    const draftActivity = await request('/api/teacher/activities', {
      method: 'POST',
      headers: { ...sessionHeaders(teacher.sessionCookie), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Actividad para niveles de IA',
        classId,
        dueDate: '2026-12-21',
        activityType: 'Proyecto',
        evaluationPhase: 'pilot',
      }),
    });
    expect(draftActivity.response.status).toBe(201);
    const draftActivityId = (draftActivity.body as { id: number }).id;
    const endpoint = `/api/student/activities/${draftActivityId}/ai-declaration`;
    const declaration = {
      toolName: 'Claude',
      purpose: 'Contrastar fuentes',
      promptSummary: 'Comparar argumentos',
    };

    const initial = await request(endpoint, {
      headers: sessionHeaders(student.sessionCookie),
    });
    expect(initial.response.status).toBe(200);
    expect(initial.body).toMatchObject({ usageLevel: null, updatedAt: null });

    for (const usageLevel of [1, 2, 3]) {
      const updated = await request(endpoint, {
        method: 'PUT',
        headers: { ...sessionHeaders(student.sessionCookie), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...declaration, usageLevel }),
      });
      expect(updated.response.status).toBe(200);
      expect(updated.body).toMatchObject({ usageLevel });

      const persisted = await dataSource.getRepository(AiDeclaration).findOneOrFail({
        where: { student: { id: student.user.id }, activity: { id: draftActivityId } },
      });
      expect(persisted.usageLevel).toBe(usageLevel);
    }

    for (const usageLevel of [undefined, null, 0, 4, 1.5, true, false, '2']) {
      const invalid = await request(endpoint, {
        method: 'PUT',
        headers: { ...sessionHeaders(student.sessionCookie), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...declaration, usageLevel }),
      });
      expect(invalid.response.status).toBe(400);
    }

    const unchanged = await dataSource.getRepository(AiDeclaration).findOneOrFail({
      where: { student: { id: student.user.id }, activity: { id: draftActivityId } },
    });
    expect(unchanged.usageLevel).toBe(3);

    const teacherAttempt = await request(endpoint, {
      method: 'PUT',
      headers: { ...sessionHeaders(teacher.sessionCookie), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...declaration, usageLevel: 2 }),
    });
    expect(teacherAttempt.response.status).toBe(403);
    const anonymousAttempt = await request(endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...declaration, usageLevel: 2 }),
    });
    expect(anonymousAttempt.response.status).toBe(401);

    const users = dataSource.getRepository(User);
    const authService = app.get(AuthService);
    await users.save(
      users.create({
        email: 'estudiante.sin.matricula.nivel@unah.edu.hn',
        name: 'Estudiante sin matrícula',
        passwordHash: await authService.hashPassword('SinMatricula123!'),
        role: UserRole.STUDENT,
        active: true,
      }),
    );
    const unenrolledLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'estudiante.sin.matricula.nivel@unah.edu.hn',
        password: 'SinMatricula123!',
      }),
    });
    const unenrolledCookie = readSessionCookie(unenrolledLogin.response);
    const unenrolledAttempt = await request(endpoint, {
      method: 'PUT',
      headers: { ...sessionHeaders(unenrolledCookie), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...declaration, usageLevel: 2 }),
    });
    expect(unenrolledAttempt.response.status).toBe(404);

    for (const usageLevel of ['1', '2', '3']) {
      const form = new FormData();
      form.set('productText', `Producto con nivel ${usageLevel}`);
      form.set('productUrl', '');
      form.set('toolName', declaration.toolName);
      form.set('usageLevel', usageLevel);
      form.set('purpose', declaration.purpose);
      form.set('promptSummary', declaration.promptSummary);
      const submitted = await request(
        `/api/student/activities/${draftActivityId}/submission`,
        {
          method: 'PUT',
          headers: sessionHeaders(student.sessionCookie),
          body: form,
        },
      );
      expect(submitted.response.status).toBe(200);

      const persisted = await dataSource.getRepository(AiDeclaration).findOneOrFail({
        where: { student: { id: student.user.id }, activity: { id: draftActivityId } },
      });
      expect(persisted.usageLevel).toBe(Number(usageLevel));
    }
  });

  it('valida y muestra un propósito normalizado de forma consistente', async () => {
    const draftActivity = await request('/api/teacher/activities', {
      method: 'POST',
      headers: { ...sessionHeaders(teacher.sessionCookie), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Actividad para propósito de IA',
        classId,
        dueDate: '2026-12-22',
        activityType: 'Investigación',
        evaluationPhase: 'pilot',
      }),
    });
    expect(draftActivity.response.status).toBe(201);
    const draftActivityId = (draftActivity.body as { id: number }).id;
    const endpoint = `/api/student/activities/${draftActivityId}/ai-declaration`;
    const declaration = {
      toolName: 'Claude',
      usageLevel: 2,
      promptSummary: 'Consultas para contrastar argumentos',
    };
    const updatePurpose = (cookie: string, purpose: unknown) =>
      request(endpoint, {
        method: 'PUT',
        headers: { ...sessionHeaders(cookie), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...declaration, purpose }),
      });

    const paragraphs = 'Primer párrafo del propósito.\n\nSegundo párrafo con contexto.';
    const created = await updatePurpose(student.sessionCookie, `  ${paragraphs}  `);
    expect(created.response.status).toBe(200);
    expect(created.body).toMatchObject({ purpose: paragraphs });

    const updated = await updatePurpose(
      student.sessionCookie,
      'Propósito actualizado durante el trabajo',
    );
    expect(updated.response.status).toBe(200);
    expect(updated.body).toMatchObject({ purpose: 'Propósito actualizado durante el trabajo' });

    const maximumPurpose = 'a'.repeat(5000);
    const maximum = await updatePurpose(student.sessionCookie, maximumPurpose);
    expect(maximum.response.status).toBe(200);
    expect((maximum.body as { purpose: string }).purpose).toHaveLength(5000);

    for (const purpose of [undefined, null, '', '   ', 42, 'a'.repeat(5001)]) {
      const invalid = await updatePurpose(student.sessionCookie, purpose);
      expect(invalid.response.status).toBe(400);
    }

    const unchanged = await dataSource.getRepository(AiDeclaration).findOneOrFail({
      where: { student: { id: student.user.id }, activity: { id: draftActivityId } },
    });
    expect(unchanged.purpose).toBe(maximumPurpose);

    expect((await updatePurpose(teacher.sessionCookie, paragraphs)).response.status).toBe(403);
    expect((await updatePurpose('', paragraphs)).response.status).toBe(401);

    const users = dataSource.getRepository(User);
    const authService = app.get(AuthService);
    await users.save(
      users.create({
        email: 'estudiante.sin.matricula.proposito@unah.edu.hn',
        name: 'Estudiante sin matrícula para propósito',
        passwordHash: await authService.hashPassword('SinMatricula123!'),
        role: UserRole.STUDENT,
        active: true,
      }),
    );
    const unenrolledLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'estudiante.sin.matricula.proposito@unah.edu.hn',
        password: 'SinMatricula123!',
      }),
    });
    const unenrolledCookie = readSessionCookie(unenrolledLogin.response);
    expect((await updatePurpose(unenrolledCookie, paragraphs)).response.status).toBe(404);

    const independentPurpose = 'Propósito guardado antes de la entrega';
    const independent = await updatePurpose(student.sessionCookie, `  ${independentPurpose}  `);
    expect(independent.response.status).toBe(200);
    const declarationBeforeSubmission = await dataSource
      .getRepository(AiDeclaration)
      .findOneOrFail({
        where: { student: { id: student.user.id }, activity: { id: draftActivityId } },
      });
    expect(declarationBeforeSubmission.purpose).toBe(independentPurpose);

    const submittedPurpose = 'Apoyar la comparación de fuentes.\n\nDocumentar contraargumentos.';
    const form = new FormData();
    form.set('productText', 'Producto académico con propósito declarado');
    form.set('productUrl', '');
    form.set('toolName', declaration.toolName);
    form.set('usageLevel', String(declaration.usageLevel));
    form.set('purpose', `  ${submittedPurpose}  `);
    form.set('promptSummary', declaration.promptSummary);
    const submitted = await request(
      `/api/student/activities/${draftActivityId}/submission`,
      {
        method: 'PUT',
        headers: sessionHeaders(student.sessionCookie),
        body: form,
      },
    );
    expect(submitted.response.status).toBe(200);

    const declarationAfterSubmission = await dataSource
      .getRepository(AiDeclaration)
      .findOneOrFail({
        where: { student: { id: student.user.id }, activity: { id: draftActivityId } },
      });
    expect(declarationAfterSubmission.id).toBe(declarationBeforeSubmission.id);
    expect(declarationAfterSubmission.purpose).toBe(submittedPurpose);

    const submissions = await request(
      `/api/teacher/activities/${draftActivityId}/submissions`,
      { headers: sessionHeaders(teacher.sessionCookie) },
    );
    expect(submissions.response.status).toBe(200);
    const teacherSubmissionId = (submissions.body as Array<{ id: number }>)[0].id;
    const detail = await request(`/api/teacher/submissions/${teacherSubmissionId}`, {
      headers: sessionHeaders(teacher.sessionCookie),
    });
    expect(detail.response.status).toBe(200);
    expect(detail.body).toMatchObject({
      aiDeclaration: { purpose: submittedPurpose },
    });
  });

  it('ejecuta el flujo base con matrícula, siete dimensiones, bitácora, declaración y archivo', async () => {
    const teacherActivities = await request('/api/teacher/activities', {
      headers: sessionHeaders(teacher.sessionCookie),
    });
    const configuredActivity = (teacherActivities.body as Array<{
      id: number;
      evaluationPhase: ActivityPhase;
      rubric: { criteria: unknown[] };
    }>).find((activity) => activity.id === activityId)!;
    expect(configuredActivity).toBeDefined();
    expect(configuredActivity.evaluationPhase).toBe(ActivityPhase.PILOT);
    expect(configuredActivity.rubric.criteria).toHaveLength(7);

    const studentActivities = await request('/api/student/activities', {
      headers: sessionHeaders(student.sessionCookie),
    });
    expect(
      (studentActivities.body as Array<{ id: number }>).some((activity) => activity.id === activityId),
    ).toBe(true);

    const logbook = await request(`/api/student/activities/${activityId}/logbook`, {
      method: 'PUT',
      headers: {
        ...sessionHeaders(student.sessionCookie),
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
      headers: sessionHeaders(student.sessionCookie),
      body: form,
    });
    expect(submitted.response.status).toBe(200);

    const submissions = await request(`/api/teacher/activities/${activityId}/submissions`, {
      headers: sessionHeaders(teacher.sessionCookie),
    });
    submissionId = (submissions.body as Array<{ id: number }>)[0].id;
    const detail = await request(`/api/teacher/submissions/${submissionId}`, {
      headers: sessionHeaders(teacher.sessionCookie),
    });
    expect(detail.body).toMatchObject({
      fileName: 'evidencia.txt',
      aiDeclaration: { toolName: 'ChatGPT', usageLevel: 2 },
    });

    const downloaded = await request(`/api/teacher/submissions/${submissionId}/file`, {
      headers: sessionHeaders(teacher.sessionCookie),
    });
    expect(downloaded.response.status).toBe(200);
    expect(downloaded.body).toBe('evidencia académica');

    const studentDownload = await request(`/api/teacher/submissions/${submissionId}/file`, {
      headers: sessionHeaders(student.sessionCookie),
    });
    expect(studentDownload.response.status).toBe(403);
  });

  it('evita modificar la declaración por separado después de entregar', async () => {
    const changedDeclaration = await request(
      `/api/student/activities/${activityId}/ai-declaration`,
      {
        method: 'PUT',
        headers: {
          ...sessionHeaders(student.sessionCookie),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toolName: 'Gemini',
          usageLevel: 3,
          purpose: 'Cambiar la evidencia',
          promptSummary: 'Cambio aislado',
        }),
      },
    );
    expect(changedDeclaration.response.status).toBe(409);

    const persisted = await dataSource.getRepository(AiDeclaration).findOneOrFail({
      where: { student: { id: student.user.id }, activity: { id: activityId } },
    });
    expect(persisted).toMatchObject({
      toolName: 'ChatGPT',
      usageLevel: 2,
      purpose: 'Contrastar argumentos',
      promptSummary: 'Consultas para contrastar',
    });
  });

  it('R1: persiste la degradación manual cuando el motor todavía no está disponible', async () => {
    const evaluation = await request(`/api/entregas/actividad/${activityId}/evaluar`, {
      method: 'POST',
      headers: sessionHeaders(teacher.sessionCookie),
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
    await logbooks.save(
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
      headers: sessionHeaders(student.sessionCookie),
    });
    expect(ownLogbook.body).toMatchObject({
      initialIdeas: 'Ideas propias del estudiante autenticado',
    });
    expect(JSON.stringify(ownLogbook.body)).not.toContain('Contenido secreto');
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

  // ─── HU-07 / HU-08: Gestión de criterios, dimensiones y niveles de rúbrica ───

  function buildCriteria(overrides: Partial<{ dimension: string; level1: string }>[] = []) {
    return Array.from({ length: 7 }, (_, i) => ({
      name: `Criterio ${i + 1}`,
      dimension: overrides[i]?.dimension ?? `Dimensión ${i + 1}`,
      descriptors: {
        level1: overrides[i]?.level1 ?? 'Descriptor nivel 1',
        level2: 'Descriptor nivel 2',
        level3: 'Descriptor nivel 3',
        level4: 'Descriptor nivel 4',
      },
    }));
  }

  it('HU-07/08: crea una rúbrica con exactamente siete criterios y sus cuatro niveles', async () => {
    const response = await request('/api/teacher/rubrics', {
      method: 'POST',
      headers: {
        ...sessionHeaders(teacher.sessionCookie),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Rúbrica de prueba HU-07/08',
        criteria: buildCriteria(),
      }),
    });

    expect(response.response.status).toBe(201);
    const rubric = response.body as { id: number; name: string; criteria: unknown[] };
    expect(rubric.name).toBe('Rúbrica de prueba HU-07/08');
    expect(rubric.criteria).toHaveLength(7);
    expect(rubric.id).toBeGreaterThan(0);
  });

  it('HU-07/08: la rúbrica creada aparece en el listado del docente', async () => {
    const response = await request('/api/teacher/rubrics', {
      headers: sessionHeaders(teacher.sessionCookie),
    });

    expect(response.response.status).toBe(200);
    const list = response.body as Array<{ name: string; criteria: unknown[] }>;
    const created = list.find((r) => r.name === 'Rúbrica de prueba HU-07/08');
    expect(created).toBeDefined();
    expect(created?.criteria).toHaveLength(7);
  });

  it('HU-07/08: la rúbrica incluye los descriptores de los cuatro niveles por criterio', async () => {
    const response = await request('/api/teacher/rubrics', {
      headers: sessionHeaders(teacher.sessionCookie),
    });

    const list = response.body as Array<{
      name: string;
      criteria: Array<{
        name: string;
        dimension: string;
        descriptors: { level1: string; level2: string; level3: string; level4: string };
      }>;
    }>;
    const rubric = list.find((r) => r.name === 'Rúbrica de prueba HU-07/08');
    const firstCriterion = rubric?.criteria[0];
    expect(firstCriterion?.descriptors.level1).toBe('Descriptor nivel 1');
    expect(firstCriterion?.descriptors.level2).toBe('Descriptor nivel 2');
    expect(firstCriterion?.descriptors.level3).toBe('Descriptor nivel 3');
    expect(firstCriterion?.descriptors.level4).toBe('Descriptor nivel 4');
  });

  it('HU-07: rechaza una rúbrica con menos de siete criterios', async () => {
    const response = await request('/api/teacher/rubrics', {
      method: 'POST',
      headers: {
        ...sessionHeaders(teacher.sessionCookie),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Rúbrica incompleta',
        criteria: buildCriteria().slice(0, 5),
      }),
    });

    expect(response.response.status).toBe(400);
  });

  it('HU-07: rechaza una rúbrica con más de siete criterios', async () => {
    const response = await request('/api/teacher/rubrics', {
      method: 'POST',
      headers: {
        ...sessionHeaders(teacher.sessionCookie),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Rúbrica excedida',
        criteria: [
          ...buildCriteria(),
          { name: 'Criterio extra', dimension: 'Dimensión extra', descriptors: { level1: 'A', level2: 'B', level3: 'C', level4: 'D' } },
        ],
      }),
    });

    expect(response.response.status).toBe(400);
  });

  it('HU-07: rechaza una rúbrica con dimensiones duplicadas', async () => {
    const criteriaWithDuplicate = buildCriteria();
    criteriaWithDuplicate[1].dimension = criteriaWithDuplicate[0].dimension;

    const response = await request('/api/teacher/rubrics', {
      method: 'POST',
      headers: {
        ...sessionHeaders(teacher.sessionCookie),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Rúbrica con dimensión duplicada',
        criteria: criteriaWithDuplicate,
      }),
    });

    expect(response.response.status).toBe(400);
  });

  it('HU-08: rechaza descriptores vacíos en cualquier nivel', async () => {
    const criteriaWithEmptyDescriptor = buildCriteria([{ level1: '' }]);

    const response = await request('/api/teacher/rubrics', {
      method: 'POST',
      headers: {
        ...sessionHeaders(teacher.sessionCookie),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Rúbrica con descriptor vacío',
        criteria: criteriaWithEmptyDescriptor,
      }),
    });

    expect(response.response.status).toBe(400);
  });

  it('HU-07/08: requiere autenticación para crear una rúbrica', async () => {
    const response = await request('/api/teacher/rubrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Sin sesión', criteria: buildCriteria() }),
    });

    expect(response.response.status).toBe(401);
  });

  it('HU-07/08: impide que un estudiante cree rúbricas', async () => {
    const response = await request('/api/teacher/rubrics', {
      method: 'POST',
      headers: {
        ...sessionHeaders(student.sessionCookie),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Rúbrica de estudiante', criteria: buildCriteria() }),
    });

    expect(response.response.status).toBe(403);
  });

  // ─── HU-18: Resumen de prompts ───────────────────────────────────────────────

  function buildSubmitForm(overrides: Partial<{
    productText: string;
    productUrl: string;
    toolName: string;
    usageLevel: string;
    purpose: string;
    promptSummary: string;
  }> = {}) {
    const form = new FormData();
    form.set('productText', overrides.productText ?? 'Producto de prueba HU-18/19');
    form.set('productUrl', overrides.productUrl ?? '');
    form.set('toolName', overrides.toolName ?? 'ChatGPT');
    form.set('usageLevel', overrides.usageLevel ?? '2');
    form.set('purpose', overrides.purpose ?? 'Apoyar la redacción del análisis');
    form.set('promptSummary', overrides.promptSummary ?? 'Resumen de prompts de prueba');
    return form;
  }

  it('HU-18: rechaza promptSummary ausente, vacío o formado por espacios', async () => {
    for (const promptSummary of ['', '   ']) {
      const response = await request(`/api/student/activities/${activityId}/submission`, {
        method: 'PUT',
        headers: sessionHeaders(student.sessionCookie),
        body: buildSubmitForm({ promptSummary }),
      });
      expect(response.response.status).toBe(400);
    }

    const missingSummary = buildSubmitForm();
    missingSummary.delete('promptSummary');
    const missing = await request(`/api/student/activities/${activityId}/submission`, {
      method: 'PUT',
      headers: sessionHeaders(student.sessionCookie),
      body: missingSummary,
    });
    expect(missing.response.status).toBe(400);
  });

  it('HU-18: acepta promptSummary con texto simple', async () => {
    const response = await request(`/api/student/activities/${activityId}/submission`, {
      method: 'PUT',
      headers: sessionHeaders(student.sessionCookie),
      body: buildSubmitForm({ promptSummary: 'Resumir el capítulo 3' }),
    });
    expect(response.response.status).toBe(200);
  });

  it('HU-18: acepta promptSummary con párrafos y saltos de línea', async () => {
    const paragraphs = 'Primer prompt: resumir el texto.\n\nSegundo prompt: contrastar con otra fuente.\n\nTercer prompt: revisar coherencia.';
    const response = await request(`/api/student/activities/${activityId}/submission`, {
      method: 'PUT',
      headers: sessionHeaders(student.sessionCookie),
      body: buildSubmitForm({ promptSummary: paragraphs }),
    });
    expect(response.response.status).toBe(200);
  });

  it('HU-18: acepta promptSummary en el límite de 10 000 caracteres', async () => {
    const atLimit = 'A'.repeat(10000);
    const response = await request(`/api/student/activities/${activityId}/submission`, {
      method: 'PUT',
      headers: sessionHeaders(student.sessionCookie),
      body: buildSubmitForm({ promptSummary: atLimit }),
    });
    expect(response.response.status).toBe(200);
  });

  it('HU-18: rechaza promptSummary que supera los 10 000 caracteres', async () => {
    const overLimit = 'A'.repeat(10001);
    const response = await request(`/api/student/activities/${activityId}/submission`, {
      method: 'PUT',
      headers: sessionHeaders(student.sessionCookie),
      body: buildSubmitForm({ promptSummary: overLimit }),
    });
    expect(response.response.status).toBe(400);
  });

  it('HU-18: persiste el promptSummary y es visible en la consulta del docente', async () => {
    const summary = 'Resumen de prompts para prueba de persistencia';
    await request(`/api/student/activities/${activityId}/submission`, {
      method: 'PUT',
      headers: sessionHeaders(student.sessionCookie),
      body: buildSubmitForm({ promptSummary: summary }),
    });

    const submissions = await request(`/api/teacher/activities/${activityId}/submissions`, {
      headers: sessionHeaders(teacher.sessionCookie),
    });
    const list = submissions.body as Array<{ id: number }>;
    const detail = await request(`/api/teacher/submissions/${list[0].id}`, {
      headers: sessionHeaders(teacher.sessionCookie),
    });
    const body = detail.body as { aiDeclaration: { promptSummary: string } };
    expect(body.aiDeclaration.promptSummary).toBe(summary);
  });

  it('HU-18: mantiene consistencia entre declaración, entrega, permisos y consulta docente', async () => {
    const newActivity = await request('/api/teacher/activities', {
      method: 'POST',
      headers: { ...sessionHeaders(teacher.sessionCookie), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Actividad para resumen de prompts',
        classId,
        dueDate: '2027-01-10',
        activityType: 'Investigación',
        evaluationPhase: 'pilot',
      }),
    });
    expect(newActivity.response.status).toBe(201);
    const newActivityId = (newActivity.body as { id: number }).id;
    const endpoint = `/api/student/activities/${newActivityId}/ai-declaration`;
    const declaration = {
      toolName: 'ChatGPT',
      usageLevel: 2,
      purpose: 'Contrastar fuentes académicas',
    };
    const updateSummary = (cookie: string, promptSummary: unknown) =>
      request(endpoint, {
        method: 'PUT',
        headers: { ...sessionHeaders(cookie), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...declaration, promptSummary }),
      });

    const paragraphs = 'Primer prompt: resumir.\n\nSegundo prompt: contrastar.';
    const created = await updateSummary(
      student.sessionCookie,
      '  Primer prompt: resumir.\r\n\r\nSegundo prompt: contrastar.  ',
    );
    expect(created.response.status).toBe(200);
    expect(created.body).toMatchObject({ promptSummary: paragraphs });

    const consulted = await request(endpoint, {
      headers: sessionHeaders(student.sessionCookie),
    });
    expect(consulted.response.status).toBe(200);
    expect(consulted.body).toMatchObject({ promptSummary: paragraphs });

    const updatedSummary = 'Resumen actualizado durante el desarrollo';
    const updated = await updateSummary(student.sessionCookie, `  ${updatedSummary}  `);
    expect(updated.response.status).toBe(200);
    expect(updated.body).toMatchObject({ promptSummary: updatedSummary });

    const maximum = await updateSummary(student.sessionCookie, 'a'.repeat(10000));
    expect(maximum.response.status).toBe(200);
    expect((maximum.body as { promptSummary: string }).promptSummary).toHaveLength(10000);
    expect(
      (await updateSummary(student.sessionCookie, 'a'.repeat(10001))).response.status,
    ).toBe(400);
    for (const invalidSummary of [undefined, null, '', '   ', 42]) {
      expect((await updateSummary(student.sessionCookie, invalidSummary)).response.status).toBe(
        400,
      );
    }

    expect((await updateSummary(teacher.sessionCookie, paragraphs)).response.status).toBe(403);
    expect((await updateSummary('', paragraphs)).response.status).toBe(401);

    const users = dataSource.getRepository(User);
    const authService = app.get(AuthService);
    await users.save(
      users.create({
        email: 'estudiante.sin.matricula.resumen@unah.edu.hn',
        name: 'Estudiante sin matrícula para resumen',
        passwordHash: await authService.hashPassword('SinMatricula123!'),
        role: UserRole.STUDENT,
        active: true,
      }),
    );
    const unenrolledLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'estudiante.sin.matricula.resumen@unah.edu.hn',
        password: 'SinMatricula123!',
      }),
    });
    const unenrolledCookie = readSessionCookie(unenrolledLogin.response);
    expect((await updateSummary(unenrolledCookie, paragraphs)).response.status).toBe(404);

    const beforeSubmission = await updateSummary(student.sessionCookie, updatedSummary);
    expect(beforeSubmission.response.status).toBe(200);
    const storedBeforeSubmission = await dataSource
      .getRepository(AiDeclaration)
      .findOneOrFail({
        where: { student: { id: student.user.id }, activity: { id: newActivityId } },
      });

    const deliveredSummary = 'Prompt para sintetizar.\n\nPrompt para verificar fuentes.';
    const form = buildSubmitForm({
      productText: 'Producto con resumen de prompts',
      promptSummary: `  Prompt para sintetizar.\r\n\r\nPrompt para verificar fuentes.  `,
    });
    const submitted = await request(`/api/student/activities/${newActivityId}/submission`, {
      method: 'PUT',
      headers: sessionHeaders(student.sessionCookie),
      body: form,
    });
    expect(submitted.response.status).toBe(200);

    const storedAfterSubmission = await dataSource
      .getRepository(AiDeclaration)
      .findOneOrFail({
        where: { student: { id: student.user.id }, activity: { id: newActivityId } },
      });
    expect(storedAfterSubmission.id).toBe(storedBeforeSubmission.id);
    expect(storedAfterSubmission.promptSummary).toBe(deliveredSummary);

    const submissions = await request(`/api/teacher/activities/${newActivityId}/submissions`, {
      headers: sessionHeaders(teacher.sessionCookie),
    });
    const teacherSubmissionId = (submissions.body as Array<{ id: number }>)[0].id;
    const detail = await request(`/api/teacher/submissions/${teacherSubmissionId}`, {
      headers: sessionHeaders(teacher.sessionCookie),
    });
    expect(detail.response.status).toBe(200);
    expect(detail.body).toMatchObject({
      aiDeclaration: { promptSummary: deliveredSummary },
    });
  });

  // ─── HU-19: Entrega del producto final ───────────────────────────────────────

  it('HU-19: acepta entrega solamente con archivo, sin texto ni URL', async () => {
    const form = new FormData();
    form.set('productText', '');
    form.set('productUrl', '');
    form.set('toolName', 'ChatGPT');
    form.set('usageLevel', '1');
    form.set('purpose', 'Apoyo para estructurar ideas');
    form.set('promptSummary', 'Resumen de prompts utilizados para preparar el archivo');
    form.set('file', new Blob(['contenido del archivo'], { type: 'text/plain' }), 'entrega.txt');

    const response = await request(`/api/student/activities/${activityId}/submission`, {
      method: 'PUT',
      headers: sessionHeaders(student.sessionCookie),
      body: form,
    });
    expect(response.response.status).toBe(200);
  });

  it('HU-19: acepta archivo de exactamente 10 MB', async () => {
    const tenMB = new Blob([new Uint8Array(10 * 1024 * 1024)], { type: 'application/octet-stream' });
    const form = buildSubmitForm();
    form.set('file', tenMB, 'archivo-10mb.bin');

    const response = await request(`/api/student/activities/${activityId}/submission`, {
      method: 'PUT',
      headers: sessionHeaders(student.sessionCookie),
      body: form,
    });
    expect(response.response.status).toBe(200);
  });

  it('HU-19: rechaza archivo que supera 10 MB en un byte', async () => {
    const overLimit = new Blob([new Uint8Array(10 * 1024 * 1024 + 1)], { type: 'application/octet-stream' });
    const form = buildSubmitForm();
    form.set('file', overLimit, 'archivo-too-large.bin');

    const response = await request(`/api/student/activities/${activityId}/submission`, {
      method: 'PUT',
      headers: sessionHeaders(student.sessionCookie),
      body: form,
    });
    expect(response.response.status).toBe(413);
  });

  it('HU-19: rechaza entrega vacía — sin texto, URL ni archivo previo', async () => {
    // Actividad nueva donde el estudiante nunca ha entregado
    const newActivity = await request('/api/teacher/activities', {
      method: 'POST',
      headers: { ...sessionHeaders(teacher.sessionCookie), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Actividad para entrega vacía',
        classId,
        dueDate: '2026-12-31',
        activityType: 'Ensayo',
        evaluationPhase: 'pilot',
      }),
    });
    const newActivityId = (newActivity.body as { id: number }).id;

    const response = await request(`/api/student/activities/${newActivityId}/submission`, {
      method: 'PUT',
      headers: sessionHeaders(student.sessionCookie),
      body: buildSubmitForm({ productText: '', productUrl: '' }),
    });
    expect(response.response.status).toBe(400);
  });

  it('HU-19: actualizar la entrega no genera duplicados', async () => {
    // Primera entrega
    await request(`/api/student/activities/${activityId}/submission`, {
      method: 'PUT',
      headers: sessionHeaders(student.sessionCookie),
      body: buildSubmitForm({ productText: 'Primera versión del producto' }),
    });
    // Segunda entrega — actualización
    await request(`/api/student/activities/${activityId}/submission`, {
      method: 'PUT',
      headers: sessionHeaders(student.sessionCookie),
      body: buildSubmitForm({ productText: 'Versión actualizada del producto' }),
    });

    const submissions = await request(`/api/teacher/activities/${activityId}/submissions`, {
      headers: sessionHeaders(teacher.sessionCookie),
    });
    const list = submissions.body as Array<{ id: number }>;
    // Solo debe existir una entrega por estudiante por actividad
    const studentSubmissions = list.filter(Boolean);
    expect(studentSubmissions.length).toBeGreaterThanOrEqual(1);

    const detail = await request(`/api/teacher/submissions/${list[0].id}`, {
      headers: sessionHeaders(teacher.sessionCookie),
    });
    const body = detail.body as { productText: string };
    expect(body.productText).toBe('Versión actualizada del producto');
  });

  it('HU-19: normaliza productUrl con espacios antes de validarla', async () => {
    const response = await request(`/api/student/activities/${activityId}/submission`, {
      method: 'PUT',
      headers: sessionHeaders(student.sessionCookie),
      body: buildSubmitForm({ productUrl: '  https://ejemplo.com/entrega  ' }),
    });
    expect(response.response.status).toBe(200);
  });
});
