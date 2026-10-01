import { EvaluationStatus, SubmissionStatus } from '../entities/submission.entity';
import { UserRole } from '../entities/user.entity';
import { SubmissionsService } from './submissions.service';

describe('SubmissionsService', () => {
  it('rechaza el reenvio de una entrega evaluada sin borrar su evaluacion', async () => {
    const submissions = {
      findOne: jest.fn().mockResolvedValue({
        id: 8,
        status: SubmissionStatus.EVALUATED,
        productText: 'Producto evaluado',
      }),
    };
    const dataSource = { transaction: jest.fn() };
    const service = new SubmissionsService(
      submissions as never,
      {} as never,
      {} as never,
      {} as never,
      dataSource as never,
      { getForStudent: jest.fn().mockResolvedValue({ id: 4 }) } as never,
      {} as never,
    );

    await expect(
      service.submit({ id: 2 } as never, 4, {
        productText: 'Producto modificado',
        productUrl: '',
        toolName: 'ChatGPT',
        usageLevel: 2,
        purpose: 'Modificar evidencia',
        promptSummary: 'Prompt modificado',
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('guarda producto y declaración de IA dentro de la misma transacción', async () => {
    const student = { id: 2, role: UserRole.STUDENT };
    const activity = { id: 4, title: 'Actividad', academicClass: { id: 1 } };
    const storedSubmission = {
      id: 8,
      student,
      activity,
      status: SubmissionStatus.SUBMITTED,
      submittedAt: new Date(),
      productText: 'Producto',
      productUrl: '',
      fileName: 'evidencia.pdf',
    };
    const submissions = {
      findOne: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(storedSubmission),
      count: jest.fn().mockResolvedValue(0),
    };
    const submissionRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => ({ ...value })),
      save: jest.fn(async (value) => ({ ...value, id: 8 })),
    };
    const declarationRepository = {
      findOne: jest.fn().mockResolvedValue({
        detectedUsageLevel: 3,
        usageDiscrepancy: true,
      }),
      create: jest.fn((value) => ({ ...value })),
      save: jest.fn(async (value) => value),
    };
    const valuationRepository = {
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    const manager = {
      getRepository: jest.fn((entity: { name: string }) => {
        if (entity.name === 'Submission') return submissionRepository;
        if (entity.name === 'AiDeclaration') return declarationRepository;
        return valuationRepository;
      }),
    };
    const dataSource = { transaction: jest.fn(async (work) => work(manager)) };
    const activitiesService = {
      getForStudent: jest.fn().mockResolvedValue(activity),
      setManualEvaluationRequired: jest.fn().mockResolvedValue(activity),
    };
    const logbooks = {
      findOne: jest.fn().mockResolvedValue({
        initialIdeas: 'Ideas iniciales',
        prompts: 'Prompt utilizado',
        validationsAndDecisions: 'Validaciones y decisiones',
        finalReflection: 'Reflexión final',
      }),
    };
    const aiConversations = {
      getForStudent: jest.fn().mockResolvedValue({
        messages: [
          { role: 'student', content: 'Prompt', sequence: 0 },
          { role: 'ai', content: 'Respuesta', sequence: 1 },
        ],
      }),
      attachToSubmission: jest.fn(),
    };
    const service = new SubmissionsService(
      submissions as never,
      logbooks as never,
      {} as never,
      {} as never,
      dataSource as never,
      activitiesService as never,
      {} as never,
      undefined,
      aiConversations as never,
    );

    const result = await service.submit(student as never, 4, {
      productText: 'Producto',
      productUrl: '',
      toolName: 'ChatGPT',
      usageLevel: 2,
      purpose: 'Contrastar ideas',
      promptSummary: 'Consulta de contraste',
    }, {
      originalname: 'evidencia.pdf',
      mimetype: 'application/pdf',
      size: 8,
      buffer: Buffer.from('%PDF-1.4'),
    });

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(submissionRepository.save).toHaveBeenCalledTimes(1);
    expect(submissionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ aiPromptAssessment: null }),
    );
    expect(declarationRepository.save).toHaveBeenCalledTimes(1);
    expect(declarationRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ detectedUsageLevel: null, usageDiscrepancy: false }),
    );
    expect(valuationRepository.delete).toHaveBeenCalledWith({ submission: { id: 8 } });
    expect(activitiesService.setManualEvaluationRequired).toHaveBeenCalledWith(activity, false);
    expect(result.status).toBe(SubmissionStatus.SUBMITTED);
  });

  it('calcula la sugerencia porcentual IA y la decisión docente con la escala académica', async () => {
    const submission = {
      id: 8,
      activity: { id: 4, title: 'Actividad' },
      student: { id: 2, name: 'Estudiante', email: 'estudiante@unah.edu.hn' },
      aiAnalyzedAt: new Date('2026-09-30T12:00:00.000Z') as Date | null,
      aiLearningOutcomeAssessments: [],
    };
    const valuationList = [
      {
        id: 1,
        criterion: 'Criterio 1',
        dimension: 'Dimensión 1',
        aiValue: 1,
        aiExplanation: 'Evidencia inicial.',
        teacherValue: 2,
        teacherComment: 'Ajuste docente.',
        confirmed: true,
      },
      {
        id: 2,
        criterion: 'Criterio 2',
        dimension: 'Dimensión 2',
        aiValue: 4,
        aiExplanation: 'Evidencia avanzada.',
        teacherValue: 4,
        teacherComment: 'Confirmado.',
        confirmed: true,
      },
    ];
    const activitiesService = {
      ownedActivity: jest.fn().mockResolvedValue({
        id: 4,
        rubric: { criteria: [{ name: 'Criterio 1' }, { name: 'Criterio 2' }] },
      }),
    };
    const service = new SubmissionsService(
      { findOne: jest.fn().mockResolvedValue(submission) } as never,
      { findOne: jest.fn().mockResolvedValue(null) } as never,
      { findOne: jest.fn().mockResolvedValue(null) } as never,
      { find: jest.fn().mockResolvedValue(valuationList) } as never,
      {} as never,
      activitiesService as never,
      {} as never,
    );

    const detail = await service.getForTeacher(3, 8);

    expect(activitiesService.ownedActivity).toHaveBeenCalledWith(3, 4, true);
    expect(detail.aiSuggestedGradePercentage).toBe(50);
    expect(detail.teacherGradePercentage).toBe(66.67);
  });

  it('no sugiere porcentaje con criterios incompletos, inválidos o sin análisis IA', async () => {
    const submission = {
      id: 8,
      activity: { id: 4, title: 'Actividad' },
      student: { id: 2, name: 'Estudiante', email: 'estudiante@unah.edu.hn' },
      aiAnalyzedAt: new Date('2026-09-30T12:00:00.000Z') as Date | null,
      aiLearningOutcomeAssessments: [],
    };
    const valuations = {
      find: jest.fn()
        .mockResolvedValueOnce([{
          id: 1,
          criterion: 'Criterio 1',
          aiValue: 3,
          teacherValue: 3,
          confirmed: false,
        }])
        .mockResolvedValueOnce([
          { id: 1, criterion: 'Criterio 1', aiValue: 3, teacherValue: 3, confirmed: true },
          { id: 2, criterion: 'Criterio 2', aiValue: 5, teacherValue: 3, confirmed: true },
        ])
        .mockResolvedValueOnce([
          { id: 1, criterion: 'Criterio 1', aiValue: 3, teacherValue: 3, confirmed: true },
          { id: 2, criterion: 'Criterio 2', aiValue: 3, teacherValue: 3, confirmed: true },
        ]),
    };
    const activitiesService = {
      ownedActivity: jest.fn().mockResolvedValue({
        id: 4,
        rubric: { criteria: [{ name: 'Criterio 1' }, { name: 'Criterio 2' }] },
      }),
    };
    const service = new SubmissionsService(
      { findOne: jest.fn().mockResolvedValue(submission) } as never,
      { findOne: jest.fn().mockResolvedValue(null) } as never,
      { findOne: jest.fn().mockResolvedValue(null) } as never,
      valuations as never,
      {} as never,
      activitiesService as never,
      {} as never,
    );

    const incomplete = await service.getForTeacher(3, 8);
    expect(incomplete.aiSuggestedGradePercentage).toBeNull();
    expect(incomplete.teacherGradePercentage).toBeNull();

    const invalid = await service.getForTeacher(3, 8);
    expect(invalid.aiSuggestedGradePercentage).toBeNull();

    submission.aiAnalyzedAt = null;
    const notAnalyzed = await service.getForTeacher(3, 8);
    expect(notAnalyzed.aiSuggestedGradePercentage).toBeNull();
  });

  it('envía al motor los criterios de la rúbrica asociada', async () => {
    const criteria = [
      {
        name: 'Argumentación',
        dimension: 'Argumentación',
        descriptors: {
          level1: 'Inicial',
          level2: 'Básico',
          level3: 'Competente',
          level4: 'Avanzado',
        },
      },
    ];
    const activity = {
      id: 4,
      title: 'Actividad',
      subject: 'Ingeniería de software',
      activityType: 'Ensayo',
      learningOutcomes: ['Argumenta una solución usando evidencia verificable.'],
      rubric: { id: 6, criteria },
    };
    const submission = {
      id: 8,
      student: { id: 2 },
      productText: 'Producto',
      productUrl: '',
      fileName: null,
    };
    const submissions = {
      find: jest.fn().mockResolvedValue([submission]),
      save: jest.fn(async (value) => value),
      count: jest.fn().mockResolvedValue(1),
    };
    const activitiesService = {
      ownedActivity: jest.fn().mockResolvedValue(activity),
      setManualEvaluationRequired: jest.fn().mockResolvedValue(activity),
    };
    const aiEngine = {
      analyzeEvidence: jest.fn().mockResolvedValue({ implemented: false, reason: 'Stub' }),
    };
    const service = new SubmissionsService(
      submissions as never,
      { findOne: jest.fn().mockResolvedValue(null) } as never,
      { findOne: jest.fn().mockResolvedValue(null) } as never,
      {} as never,
      {} as never,
      activitiesService as never,
      aiEngine as never,
    );

    await service.evaluateActivity(3, 4);

    expect(activitiesService.ownedActivity).toHaveBeenCalledWith(3, 4, true);
    expect(aiEngine.analyzeEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        activity: {
          title: activity.title,
          subject: activity.subject,
          activityType: activity.activityType,
        },
        rubric: criteria,
        learningOutcomes: activity.learningOutcomes,
      }),
    );
  });

  it('procesa cinco entregas, reintenta revisión manual y persiste siete valoraciones por cada una', async () => {
    const criteria = Array.from({ length: 7 }, (_, index) => ({
      name: `Criterio ${index + 1}`,
      dimension: `Dimensión ${index + 1}`,
      descriptors: {
        level1: 'Inicial',
        level2: 'Básico',
        level3: 'Competente',
        level4: 'Avanzado',
      },
    }));
    const activity = {
      id: 4,
      title: 'Actividad',
      subject: 'Ingeniería de software',
      activityType: 'Ensayo',
      learningOutcomes: ['Argumenta una solución usando evidencia verificable.'],
      teacher: { id: 3 },
      rubric: { id: 6, criteria },
    };
    const submission = {
      id: 8,
      student: { id: 2, name: 'Ana Pérez', email: 'ana.perez@unah.edu.hn' },
      status: SubmissionStatus.UNDER_REVIEW,
      evaluationStatus: EvaluationStatus.MANUAL_REQUIRED,
      manualReviewRequired: true,
      productText: 'Producto',
      productUrl: '',
      fileName: null,
      feedback: '',
      aiPossibleGrade: 85,
    };
    const batch = Array.from({ length: 5 }, (_, index) => ({
      ...submission,
      id: submission.id + index,
      student: index === 0
        ? submission.student
        : {
            id: submission.student.id + index,
            name: `Estudiante ${index + 1}`,
            email: `estudiante${index + 1}@unah.edu.hn`,
          },
    }));
    const submissions = {
      find: jest.fn().mockResolvedValue(batch),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      save: jest.fn(async (value) => value),
      count: jest.fn().mockResolvedValue(5),
    };
    const declarations = {
      findOne: jest.fn().mockResolvedValue({
        usageLevel: 2,
        toolName: 'Gemini',
        purpose: 'Contrastar',
        promptSummary: 'Resumen',
        detectedUsageLevel: null,
        usageDiscrepancy: false,
      }),
      save: jest.fn(async (value) => value),
    };
    const valuations = {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((value) => ({ ...value })),
      save: jest.fn(async (value) => value),
      remove: jest.fn(async (value) => value),
    };
    const activitiesService = {
      ownedActivity: jest.fn().mockResolvedValue(activity),
      setManualEvaluationRequired: jest.fn().mockResolvedValue(activity),
    };
    const aiEngine = {
      analyzeEvidence: jest.fn().mockResolvedValue({
        implemented: true,
        requiresManualReview: true,
        detectedUsageLevel: 3,
        valuations: criteria.map((criterion) => ({
          criterion: criterion.name,
          dimension: criterion.dimension,
          level: 3,
          explanation: `Evidencia para ${criterion.name}`,
        })),
        feedback: 'Retroalimentación preliminar',
        strengths: 'Fortalezas',
        improvements: 'Mejoras',
        comparison: 'Existe una diferencia.',
        understandingScore: 84,
        understandingExplanation: 'Comprende el tema con evidencia suficiente.',
        learningOutcomeAssessments: [{
          learningOutcome: activity.learningOutcomes[0],
          score: 84,
          explanation: 'Argumenta con evidencia.',
          evidence: ['Evidencia concreta del producto.'],
        }],
        promptAssessment: {
          scorePercentage: 66.67,
          summary: 'Los prompts son pertinentes y requieren mayor verificación.',
          dimensions: {
            relevance: 4,
            clarity: 3,
            refinement: 3,
            verification: 2,
            criticalThinking: 3,
          },
          prompts: [{
            sequence: 0,
            content: 'Prompt',
            purpose: 'verification',
            score: 3,
            explanation: 'Solicita contraste.',
          }],
        },
      }),
    };
    const aiConversations = {
      getForTeacher: jest.fn().mockResolvedValue({
        messages: [
          { role: 'student', content: 'Prompt', sequence: 0 },
          { role: 'ai', content: 'Respuesta', sequence: 1 },
        ],
      }),
    };
    const notifications = { dispatchAiAnalysisReady: jest.fn().mockResolvedValue(undefined) };
    const service = new SubmissionsService(
      submissions as never,
      { findOne: jest.fn().mockResolvedValue(null) } as never,
      declarations as never,
      valuations as never,
      {} as never,
      activitiesService as never,
      aiEngine as never,
      undefined,
      aiConversations as never,
      notifications as never,
    );

    const result = await service.evaluateActivity(3, 4);

    expect(result).toMatchObject({ processed: 5, analyzed: 5, failed: 0, valuationsCreated: 35 });
    expect(aiEngine.analyzeEvidence).toHaveBeenCalledTimes(5);
    expect(valuations.save).toHaveBeenCalledTimes(5);
    expect(valuations.save).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ criterion: 'Criterio 1', aiValue: 3 }),
      expect.objectContaining({ criterion: 'Criterio 7', aiValue: 3 }),
    ]));
    expect(aiEngine.analyzeEvidence).toHaveBeenCalledWith(expect.objectContaining({
      identityTerms: ['Ana Pérez', 'ana.perez@unah.edu.hn'],
      product: expect.objectContaining({ document: null }),
      conversation: [
        { role: 'student', content: 'Prompt', sequence: 0 },
        { role: 'ai', content: 'Respuesta', sequence: 1 },
      ],
    }));
    expect(submissions.save).toHaveBeenCalledWith(expect.objectContaining({
      evaluationStatus: EvaluationStatus.ANALYZED,
      manualReviewRequired: true,
      aiPossibleGrade: null,
      aiUnderstandingScore: 84,
      aiLearningOutcomeAssessments: expect.arrayContaining([
        expect.objectContaining({ score: 84 }),
      ]),
      aiPromptAssessment: expect.objectContaining({ scorePercentage: 66.67 }),
    }));
    expect(declarations.save).toHaveBeenCalledWith(expect.objectContaining({
      detectedUsageLevel: 3,
      usageDiscrepancy: true,
    }));
    expect(notifications.dispatchAiAnalysisReady).toHaveBeenCalledWith(
      activity.teacher,
      submission.student,
      activity.title,
      activity.id,
      true,
    );
  });

  it('continúa el lote cuando el proveedor falla entre entregas y conserva las ya analizadas', async () => {
    const criterion = {
      name: 'Argumentación',
      dimension: 'Análisis',
      descriptors: {
        level1: 'Inicial',
        level2: 'Básico',
        level3: 'Competente',
        level4: 'Avanzado',
      },
    };
    const activity = {
      id: 9,
      title: 'Lote parcial',
      subject: 'Ingeniería de software',
      activityType: 'Ensayo',
      learningOutcomes: ['Argumenta una solución usando evidencia verificable.'],
      teacher: { id: 3 },
      rubric: { id: 5, criteria: [criterion] },
    };
    const submissionsBatch = [1, 2, 3].map((id) => ({
      id,
      student: { id, name: `Estudiante ${id}`, email: `e${id}@unah.edu.hn` },
      status: SubmissionStatus.SUBMITTED,
      evaluationStatus: EvaluationStatus.NOT_REQUESTED,
      manualReviewRequired: false,
      productText: `Producto ${id}`,
      productUrl: '',
      fileName: null,
      feedback: '',
      aiPossibleGrade: null,
    }));
    const submissions = {
      find: jest.fn().mockResolvedValue(submissionsBatch),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      save: jest.fn(async (value) => value),
      count: jest.fn().mockResolvedValue(2),
    };
    const valuations = {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((value) => ({ ...value })),
      save: jest.fn(async (value) => value),
      remove: jest.fn(async (value) => value),
    };
    const successfulAnalysis = {
      implemented: true,
      requiresManualReview: true,
      detectedUsageLevel: 2,
      valuations: [{
        criterion: criterion.name,
        dimension: criterion.dimension,
        level: 3,
        explanation: 'Evidencia concreta.',
      }],
      feedback: '',
      strengths: '',
      improvements: '',
      comparison: '',
      understandingScore: 76,
      understandingExplanation: 'Comprensión suficiente.',
      learningOutcomeAssessments: [{
        learningOutcome: activity.learningOutcomes[0],
        score: 76,
        explanation: 'Existe evidencia suficiente.',
        evidence: ['Producto 2.'],
      }],
      promptAssessment: null,
    };
    const aiEngine = {
      analyzeEvidence: jest.fn()
        .mockResolvedValueOnce({ implemented: false, reason: 'HTTP 503' })
        .mockResolvedValueOnce(successfulAnalysis)
        .mockResolvedValueOnce({ implemented: false, reason: 'Timeout' }),
    };
    const activitiesService = {
      ownedActivity: jest.fn().mockResolvedValue(activity),
      setManualEvaluationRequired: jest.fn().mockResolvedValue(activity),
    };
    const service = new SubmissionsService(
      submissions as never,
      { findOne: jest.fn().mockResolvedValue(null) } as never,
      { findOne: jest.fn().mockResolvedValue(null) } as never,
      valuations as never,
      {} as never,
      activitiesService as never,
      aiEngine as never,
    );

    const result = await service.evaluateActivity(3, activity.id);

    expect(result).toMatchObject({
      processed: 3,
      analyzed: 1,
      failed: 2,
      pendingManualReview: 2,
      implemented: true,
    });
    expect(result.reason).toContain('HTTP 503');
    expect(result.reason).toContain('Timeout');
    expect(aiEngine.analyzeEvidence).toHaveBeenCalledTimes(3);
    expect(submissions.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 2,
      evaluationStatus: EvaluationStatus.ANALYZED,
    }));
    expect(submissions.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 1,
      evaluationStatus: EvaluationStatus.MANUAL_REQUIRED,
    }));
  });

  it('cuenta las entregas de varias actividades en una sola consulta agrupada', async () => {
    const query = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        { activityId: '4', submissionCount: '2' },
        { activityId: 7, submissionCount: 1 },
      ]),
    };
    const submissions = { createQueryBuilder: jest.fn().mockReturnValue(query) };
    const service = new SubmissionsService(
      submissions as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const counts = await service.countByActivityIds([4, 7, 9]);

    expect(counts).toEqual(new Map([[4, 2], [7, 1]]));
    expect(query.where).toHaveBeenCalledWith(
      'activity.id IN (:...activityIds)',
      { activityIds: [4, 7, 9] },
    );
    expect(query.getRawMany).toHaveBeenCalledTimes(1);
  });
});
