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
      fileName: null,
    };
    const submissions = {
      findOne: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(storedSubmission),
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
    const activitiesService = { getForStudent: jest.fn().mockResolvedValue(activity) };
    const service = new SubmissionsService(
      submissions as never,
      {} as never,
      {} as never,
      dataSource as never,
      activitiesService as never,
      {} as never,
    );

    const result = await service.submit(student as never, 4, {
      productText: 'Producto',
      productUrl: '',
      toolName: 'ChatGPT',
      usageLevel: 2,
      purpose: 'Contrastar ideas',
      promptSummary: 'Consulta de contraste',
    });

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(submissionRepository.save).toHaveBeenCalledTimes(1);
    expect(declarationRepository.save).toHaveBeenCalledTimes(1);
    expect(result.status).toBe(SubmissionStatus.SUBMITTED);
  });
});
