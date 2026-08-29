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
});
