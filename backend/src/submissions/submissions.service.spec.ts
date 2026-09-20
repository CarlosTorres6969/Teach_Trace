import { SubmissionStatus } from '../entities/submission.entity';
import { UserRole } from '../entities/user.entity';
import { SubmissionsService } from './submissions.service';

describe('SubmissionsService', () => {
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
      save: jest.fn(async (value) => value),
    };
    const declarationRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => ({ ...value })),
      save: jest.fn(async (value) => value),
    };
    const manager = {
      getRepository: jest.fn((entity: { name: string }) =>
        entity.name === 'Submission' ? submissionRepository : declarationRepository,
      ),
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
          { role: 'student', content: 'Prompt' },
          { role: 'ai', content: 'Respuesta' },
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
    expect(declarationRepository.save).toHaveBeenCalledTimes(1);
    expect(activitiesService.setManualEvaluationRequired).toHaveBeenCalledWith(activity, false);
    expect(result.status).toBe(SubmissionStatus.SUBMITTED);
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
    const activity = { id: 4, rubric: { id: 6, criteria } };
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
      expect.objectContaining({ rubric: criteria }),
    );
  });
});
