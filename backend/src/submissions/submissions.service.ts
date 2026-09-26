import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  PayloadTooLargeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Not, Repository } from 'typeorm';
import { ActivitiesService } from '../activities/activities.service';
import { AiConversationsService } from '../ai-conversations/ai-conversations.service';
import { AiAnalysisResult, AiEngineService } from '../ai-engine/ai-engine.service';
import { normalizeAiDeclarationText } from '../ai-declarations/update-ai-declaration.dto';
import { AiDeclaration } from '../entities/ai-declaration.entity';
import { Logbook } from '../entities/logbook.entity';
import {
  EvaluationStatus,
  Submission,
  SubmissionStatus,
} from '../entities/submission.entity';
import { User } from '../entities/user.entity';
import { Valuation } from '../entities/valuation.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { SubmitEvidenceDto } from './submit-evidence.dto';
import { DocumentRepositoryService } from './document-repository.service';

export type UploadedAcademicFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

const MAX_SUBMISSION_FILE_SIZE = 10 * 1024 * 1024;

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);

  constructor(
    @InjectRepository(Submission) private readonly submissions: Repository<Submission>,
    @InjectRepository(Logbook) private readonly logbooks: Repository<Logbook>,
    @InjectRepository(AiDeclaration) private readonly declarations: Repository<AiDeclaration>,
    @InjectRepository(Valuation) private readonly valuations: Repository<Valuation>,
    private readonly dataSource: DataSource,
    private readonly activitiesService: ActivitiesService,
    private readonly aiEngine: AiEngineService,
    @Optional() private readonly documentRepository?: DocumentRepositoryService,
    @Optional() private readonly aiConversations?: AiConversationsService,
    @Optional() private readonly notificationsService?: NotificationsService,
  ) {}

  async getStatus(studentId: number, activityId: number) {
    const activity = await this.activitiesService.getForStudent(studentId, activityId);
    const submission = await this.submissions.findOne({
      where: { student: { id: studentId }, activity: { id: activityId } },
    });
    return {
      activity: { id: activity.id, title: activity.title },
      status: submission?.status ?? SubmissionStatus.NOT_SUBMITTED,
      submittedAt: submission?.submittedAt ?? null,
      productText: submission?.productText ?? '',
      productUrl: submission?.productUrl ?? '',
      fileName: submission?.fileName ?? null,
      evaluationStatus: submission?.evaluationStatus ?? EvaluationStatus.NOT_REQUESTED,
      manualReviewRequired: submission?.manualReviewRequired ?? false,
      aiStrengths: submission?.aiStrengths ?? '',
      aiImprovements: submission?.aiImprovements ?? '',
      aiComparison: submission?.aiComparison ?? '',
      aiAnalyzedAt: submission?.aiAnalyzedAt ?? null,
    };
  }

  async submit(
    student: User,
    activityId: number,
    input: SubmitEvidenceDto,
    file?: UploadedAcademicFile,
  ) {
    const activity = await this.activitiesService.getForStudent(student.id, activityId);
    const existingSubmission = await this.submissions.findOne({
      where: { student: { id: student.id }, activity: { id: activityId } },
    });
    const logbook = await this.logbooks.findOne({
      where: { student: { id: student.id }, activity: { id: activityId } },
    });
    const requiredLogbookFields = [
      ['ideas iniciales', logbook?.initialIdeas],
      ['prompts', logbook?.prompts],
      ['validaciones y decisiones', logbook?.validationsAndDecisions],
      ['reflexión final', logbook?.finalReflection],
    ] as const;
    const missingLogbookFields = requiredLogbookFields
      .filter(([, value]) => !value?.trim())
      .map(([label]) => label);
    if (missingLogbookFields.length) {
      throw new BadRequestException(
        `Completa la bitácora antes de entregar. Faltan: ${missingLogbookFields.join(', ')}`,
      );
    }

    const conversation = this.aiConversations
      ? await this.aiConversations.getForStudent(student.id, activityId)
      : null;
    const messages = conversation?.messages ?? [];
    if (
      !messages.some((message) => message.role === 'student') ||
      !messages.some((message) => message.role === 'ai')
    ) {
      throw new BadRequestException(
        'Registra al menos un prompt del estudiante y una respuesta de IA antes de entregar',
      );
    }
    const productText = input.productText.trim();
    const productUrl = input.productUrl?.trim() ?? '';
    const purpose = normalizeAiDeclarationText(input.purpose);
    if (!purpose) {
      throw new BadRequestException('El propósito del uso de IA es obligatorio');
    }
    const promptSummary = normalizeAiDeclarationText(input.promptSummary);
    if (!promptSummary) {
      throw new BadRequestException('El resumen de prompts es obligatorio');
    }
    if (!file && !existingSubmission?.fileName) {
      throw new BadRequestException('Debe adjuntar la tarea en un archivo PDF');
    }
    if (
      file &&
      (file.size > MAX_SUBMISSION_FILE_SIZE || file.buffer.length > MAX_SUBMISSION_FILE_SIZE)
    ) {
      throw new PayloadTooLargeException('El archivo de la entrega no puede superar 10 MB');
    }
    if (
      file &&
      (file.mimetype !== 'application/pdf' ||
        !file.originalname.toLowerCase().endsWith('.pdf') ||
        file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-')
    ) {
      throw new BadRequestException('El archivo de la entrega debe ser un PDF');
    }

    const storedDocument = file && this.documentRepository
      ? await this.documentRepository.save(
          {
            name: file.originalname,
            mimeType: file.mimetype,
            content: file.buffer,
          },
          `submissions/${student.id}/${activityId}`,
        )
      : null;

    let transactionSubmission: Submission | null = null;
    await this.dataSource.transaction(async (manager) => {
      const submissionRepository = manager.getRepository(Submission);
      const declarationRepository = manager.getRepository(AiDeclaration);
      const valuationRepository = manager.getRepository(Valuation);
      let submission = await submissionRepository.findOne({
        where: { student: { id: student.id }, activity: { id: activityId } },
      });
      if (!submission) {
        submission = submissionRepository.create({
          student,
          activity,
          fileName: null,
          fileMimeType: null,
          fileStorageKey: '',
          fileSize: null,
          fileBase64: null,
          feedback: '',
          aiPossibleGrade: null,
          aiStrengths: '',
          aiImprovements: '',
          aiComparison: '',
          aiAnalyzedAt: null,
          evaluationStatus: EvaluationStatus.NOT_REQUESTED,
          manualReviewRequired: false,
        });
      }
      submission.productText = productText;
      submission.productUrl = productUrl;
      submission.status = SubmissionStatus.SUBMITTED;
      submission.evaluationStatus = EvaluationStatus.NOT_REQUESTED;
      submission.manualReviewRequired = false;
      submission.aiPossibleGrade = null;
      submission.aiStrengths = '';
      submission.aiImprovements = '';
      submission.aiComparison = '';
      submission.aiAnalyzedAt = null;
      submission.feedback = '';
      submission.notificationSentAt = null;
      submission.submittedAt = new Date();
      if (file) {
        submission.fileName = file.originalname;
        submission.fileMimeType = file.mimetype;
        submission.fileStorageKey = storedDocument?.key ?? '';
        submission.fileSize = storedDocument?.size ?? file.size;
        submission.fileBase64 = storedDocument ? null : file.buffer.toString('base64');
      }
      transactionSubmission = await submissionRepository.save(submission);
      await valuationRepository.delete({ submission: { id: transactionSubmission.id } });

      let declaration = await declarationRepository.findOne({
        where: { student: { id: student.id }, activity: { id: activityId } },
      });
      if (!declaration) {
        declaration = declarationRepository.create({
          student,
          activity,
          detectedUsageLevel: null,
          usageDiscrepancy: false,
        });
      }
      declaration.toolName = normalizeAiDeclarationText(input.toolName);
      declaration.usageLevel = input.usageLevel;
      declaration.purpose = purpose;
      declaration.promptSummary = promptSummary;
      declaration.detectedUsageLevel = null;
      declaration.usageDiscrepancy = false;
      await declarationRepository.save(declaration);
    });

    const remainingManualReviews = await this.submissions.count({
      where: { activity: { id: activityId }, manualReviewRequired: true },
    });
    await this.activitiesService.setManualEvaluationRequired(
      activity,
      remainingManualReviews > 0,
    );

    if (transactionSubmission && this.aiConversations) {
      await this.aiConversations.attachToSubmission(student.id, activityId, transactionSubmission);
    }

    return this.getStatus(student.id, activityId);
  }

  async listForTeacher(teacherId: number, activityId: number) {
    await this.activitiesService.ownedActivity(teacherId, activityId);
    const submissions = await this.submissions.find({
      where: { activity: { id: activityId } },
      order: { submittedAt: 'DESC' },
    });
    return submissions.map((submission) => ({
      id: submission.id,
      student: {
        id: submission.student.id,
        name: submission.student.name,
        email: submission.student.email,
      },
      status: submission.status,
      evaluationStatus: submission.evaluationStatus,
      manualReviewRequired: submission.manualReviewRequired,
      submittedAt: submission.submittedAt,
    }));
  }

  async getForTeacher(teacherId: number, submissionId: number) {
    const submission = await this.submissions.findOne({ where: { id: submissionId } });
    if (!submission) throw new NotFoundException('La entrega no existe');
    await this.activitiesService.ownedActivity(teacherId, submission.activity.id);
    const [logbook, declaration, valuations] = await Promise.all([
      this.logbooks.findOne({
        where: { student: { id: submission.student.id }, activity: { id: submission.activity.id } },
      }),
      this.declarations.findOne({
        where: { student: { id: submission.student.id }, activity: { id: submission.activity.id } },
      }),
      this.valuations.find({
        where: { submission: { id: submission.id } },
        order: { id: 'ASC' },
      }),
    ]);
    return {
      id: submission.id,
      activity: { id: submission.activity.id, title: submission.activity.title },
      student: {
        id: submission.student.id,
        name: submission.student.name,
        email: submission.student.email,
      },
      status: submission.status,
      evaluationStatus: submission.evaluationStatus,
      manualReviewRequired: submission.manualReviewRequired,
      submittedAt: submission.submittedAt,
      productText: submission.productText,
      productUrl: submission.productUrl,
      fileName: submission.fileName,
      feedback: submission.feedback,
      aiStrengths: submission.aiStrengths,
      aiImprovements: submission.aiImprovements,
      aiComparison: submission.aiComparison,
      aiAnalyzedAt: submission.aiAnalyzedAt,
      valuations: valuations.map((valuation) => ({
        id: valuation.id,
        criterion: valuation.criterion,
        dimension: valuation.dimension,
        aiValue: valuation.aiValue,
        aiExplanation: valuation.aiExplanation,
        teacherValue: valuation.teacherValue,
        teacherComment: valuation.teacherComment,
        confirmed: valuation.confirmed,
      })),
      logbook: logbook
        ? {
            initialIdeas: logbook.initialIdeas,
            prompts: logbook.prompts,
            validationsAndDecisions: logbook.validationsAndDecisions,
            finalReflection: logbook.finalReflection,
          }
        : null,
      aiDeclaration: declaration
        ? {
            toolName: declaration.toolName,
            usageLevel: declaration.usageLevel,
            detectedUsageLevel: declaration.detectedUsageLevel,
            usageDiscrepancy: declaration.usageDiscrepancy,
            purpose: declaration.purpose,
            promptSummary: declaration.promptSummary,
          }
        : null,
      aiConversation: this.aiConversations
        ? await this.aiConversations.getForTeacher(teacherId, submissionId)
        : null,
    };
  }

  async getFileForTeacher(teacherId: number, submissionId: number) {
    const submission = await this.submissions
      .createQueryBuilder('submission')
      .addSelect('submission.fileBase64')
      .leftJoinAndSelect('submission.activity', 'activity')
      .where('submission.id = :submissionId', { submissionId })
      .getOne();
    if (!submission) throw new NotFoundException('La entrega no existe');
    await this.activitiesService.ownedActivity(teacherId, submission.activity.id);
    if ((!submission.fileStorageKey && !submission.fileBase64) || !submission.fileName) {
      throw new NotFoundException('La entrega no contiene un archivo');
    }
    const content = submission.fileStorageKey && this.documentRepository
      ? await this.documentRepository.read(submission.fileStorageKey)
      : Buffer.from(submission.fileBase64 as string, 'base64');
    return {
      name: submission.fileName,
      mimeType: submission.fileMimeType ?? 'application/octet-stream',
      content,
    };
  }

  async startManualEvaluation(teacherId: number, activityId: number) {
    const activity = await this.activitiesService.ownedActivity(teacherId, activityId, true);
    if (!activity.rubric?.criteria?.length) {
      throw new BadRequestException('Asocia una rúbrica antes de iniciar la evaluación');
    }
    // PENDING/ANALYZED/MANUAL_REQUIRED actúan como idempotencia: una entrega no se vuelve a
    // enviar al proveedor. Una nueva entrega (submit) reinicia NOT_REQUESTED y permite un nuevo análisis.
    const submissions = (await this.submissions.find({ where: { activity: { id: activityId } } }))
      .filter((submission) => submission.status !== SubmissionStatus.EVALUATED);
    let valuationsCreated = 0;
    for (const submission of submissions) {
      submission.status = SubmissionStatus.UNDER_REVIEW;
      submission.evaluationStatus = EvaluationStatus.MANUAL_REQUIRED;
      submission.manualReviewRequired = true;
      await this.submissions.save(submission);
      const existing = await this.valuations.find({ where: { submission: { id: submission.id } } });
      const existingCriteria = new Set(existing.map((valuation) => valuation.criterion));
      const missing = activity.rubric.criteria.filter((criterion) => !existingCriteria.has(criterion.name));
      if (missing.length) {
        await this.valuations.save(
          missing.map((criterion) =>
            this.valuations.create({
              activity,
              submission,
              dimension: criterion.dimension,
              criterion: criterion.name,
              aiValue: null,
              aiExplanation: '',
              teacherValue: null,
              teacherComment: '',
              confirmed: false,
            }),
          ),
        );
        valuationsCreated += missing.length;
      }
    }
    await this.activitiesService.setManualEvaluationRequired(activity, submissions.length > 0);
    return {
      activityId,
      processed: submissions.length,
      valuationsCreated,
      pendingManualReview: submissions.length,
    };
  }

  async listEvaluationDashboard(
    teacherId: number,
    filters: { classId?: number; activityId?: number; studentId?: number; status?: SubmissionStatus },
  ) {
    const submissions = await this.submissions.find({
      relations: { activity: true, student: true },
      order: { submittedAt: 'DESC' },
    });
    return submissions
      .filter((submission) => submission.activity.teacher.id === teacherId)
      .filter((submission) => !filters.classId || submission.activity.academicClass.id === filters.classId)
      .filter((submission) => !filters.activityId || submission.activity.id === filters.activityId)
      .filter((submission) => !filters.studentId || submission.student.id === filters.studentId)
      .filter((submission) => !filters.status || submission.status === filters.status)
      .map((submission) => ({
        id: submission.id,
        status: submission.status,
        evaluationStatus: submission.evaluationStatus,
        manualReviewRequired: submission.manualReviewRequired,
        submittedAt: submission.submittedAt,
        student: {
          id: submission.student.id,
          name: submission.student.name,
          email: submission.student.email,
        },
        activity: {
          id: submission.activity.id,
          title: submission.activity.title,
          dueDate: submission.activity.dueDate,
        },
        academicClass: {
          id: submission.activity.academicClass.id,
          name: submission.activity.academicClass.name,
          code: submission.activity.academicClass.code,
        },
      }));
  }

  async evaluateActivity(teacherId: number, activityId: number) {
    const activity = await this.activitiesService.ownedActivity(teacherId, activityId, true);
    const submissions = (await this.submissions.find({ where: { activity: { id: activityId } } }))
      .filter((submission) =>
        submission.status !== SubmissionStatus.NOT_SUBMITTED &&
        submission.status !== SubmissionStatus.EVALUATED &&
        (!submission.evaluationStatus ||
          submission.evaluationStatus === EvaluationStatus.NOT_REQUESTED ||
          submission.evaluationStatus === EvaluationStatus.MANUAL_REQUIRED),
      );
    let processed = 0;
    let analyzed = 0;
    let failed = 0;
    let valuationsCreated = 0;
    const failureReasons = new Set<string>();
    for (const submission of submissions) {
      // Reclamación condicional: dos peticiones concurrentes no pueden
      // enviar el mismo documento al proveedor IA. MANUAL_REQUIRED se admite
      // para reintentar fallos transitorios sin pedir una nueva entrega.
      const repositoryWithUpdate = this.submissions as Repository<Submission> & {
        update?: (criteria: unknown, partialEntity: unknown) => Promise<{ affected?: number }>;
      };
      if (repositoryWithUpdate.update) {
        const claimed = await repositoryWithUpdate.update(
          {
            id: submission.id,
            evaluationStatus: In([
              EvaluationStatus.NOT_REQUESTED,
              EvaluationStatus.MANUAL_REQUIRED,
            ]),
          },
          {
            status: SubmissionStatus.UNDER_REVIEW,
            evaluationStatus: EvaluationStatus.PENDING,
            manualReviewRequired: false,
          },
        );
        if (!claimed.affected) continue;
      } else {
        submission.status = SubmissionStatus.UNDER_REVIEW;
        submission.evaluationStatus = EvaluationStatus.PENDING;
        submission.manualReviewRequired = false;
        await this.submissions.save(submission);
      }
      processed += 1;
      submission.status = SubmissionStatus.UNDER_REVIEW;
      submission.evaluationStatus = EvaluationStatus.PENDING;
      submission.manualReviewRequired = false;
      const [logbook, declaration] = await Promise.all([
        this.logbooks.findOne({
          where: { student: { id: submission.student.id }, activity: { id: activityId } },
        }),
        this.declarations.findOne({
          where: { student: { id: submission.student.id }, activity: { id: activityId } },
        }),
      ]);
      const conversation = this.aiConversations
        ? await this.aiConversations.getForTeacher(teacherId, submission.id)
        : null;
      let result: AiAnalysisResult;
      try {
        const document = await this.getDocumentForAnalysis(submission);
        result = await this.aiEngine.analyzeEvidence({
          logbook: logbook
            ? {
                initialIdeas: logbook.initialIdeas,
                prompts: logbook.prompts,
                validationsAndDecisions: logbook.validationsAndDecisions,
                finalReflection: logbook.finalReflection,
              }
            : null,
          declaration: declaration
            ? {
                toolName: declaration.toolName,
                usageLevel: declaration.usageLevel,
                purpose: declaration.purpose,
                promptSummary: declaration.promptSummary,
              }
            : null,
          conversation: conversation?.messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          product: {
            text: submission.productText,
            url: submission.productUrl,
            document,
          },
          rubric: activity.rubric?.criteria ?? [],
          identityTerms: [submission.student.name, submission.student.email],
        });
      } catch (error: unknown) {
        this.logger.warn(`No fue posible preparar la entrega ${submission.id}: ${String(error)}`);
        result = {
          implemented: false,
          reason: 'No fue posible leer el documento almacenado; requiere evaluación manual',
        };
      }
      if (!result.implemented) {
        failureReasons.add(result.reason);
        failed += 1;
        submission.evaluationStatus = EvaluationStatus.MANUAL_REQUIRED;
        submission.manualReviewRequired = true;
        submission.aiAnalyzedAt = null;
      } else {
        analyzed += 1;
        const existingValuations = await this.valuations.find({
          where: { submission: { id: submission.id } },
        });
        const byCriterion = new Map(existingValuations.map((valuation) => [valuation.criterion, valuation]));
        const expectedCriteria = new Set(result.valuations.map((valuation) => valuation.criterion));
        const obsoleteValuations = existingValuations.filter(
          (valuation) => !expectedCriteria.has(valuation.criterion),
        );
        if (obsoleteValuations.length) await this.valuations.remove(obsoleteValuations);
        const pendingValuations = result.valuations.map((suggestion) => {
          const valuation = byCriterion.get(suggestion.criterion) ?? this.valuations.create({
            activity,
            submission,
            dimension: suggestion.dimension,
            criterion: suggestion.criterion,
            teacherValue: null,
            teacherComment: '',
            confirmed: false,
          });
          if (!valuation.id) valuationsCreated += 1;
          valuation.dimension = suggestion.dimension;
          valuation.aiValue = suggestion.level;
          valuation.aiExplanation = suggestion.explanation;
          return valuation;
        });
        if (pendingValuations.length) await this.valuations.save(pendingValuations);
        if (declaration) {
          declaration.detectedUsageLevel = result.detectedUsageLevel;
          declaration.usageDiscrepancy =
            result.detectedUsageLevel !== null &&
            declaration.usageLevel !== result.detectedUsageLevel;
          await this.declarations.save(declaration);
        }
        if (!submission.feedback.trim() && (result.feedback || result.comparison)) {
          submission.feedback = [
            result.feedback ? `Retroalimentación IA: ${result.feedback}` : '',
          ].filter(Boolean).join('\n\n');
        }
        submission.aiPossibleGrade = null;
        submission.aiStrengths = result.strengths;
        submission.aiImprovements = result.improvements;
        submission.aiComparison = result.comparison;
        submission.aiAnalyzedAt = new Date();
        submission.evaluationStatus = EvaluationStatus.ANALYZED;
        // La IA solo propone; el docente debe revisar y confirmar cada criterio.
        submission.manualReviewRequired = true;
      }
      await this.submissions.save(submission);
      if (result.implemented && this.notificationsService) {
        try {
          await this.notificationsService.dispatchAiAnalysisReady(
            activity.teacher,
            submission.student,
            activity.title,
            activity.id,
            Boolean(declaration?.usageDiscrepancy),
          );
        } catch (error: unknown) {
          // La notificación es secundaria: nunca debe invalidar un análisis ya persistido.
          this.logger.warn(`No fue posible notificar el análisis de la entrega ${submission.id}: ${String(error)}`);
        }
      }
    }
    const pendingManualReview = await this.submissions.count({
      where: {
        activity: { id: activityId },
        manualReviewRequired: true,
        status: Not(SubmissionStatus.EVALUATED),
      },
    });
    await this.activitiesService.setManualEvaluationRequired(
      activity,
      pendingManualReview > 0,
    );
    return {
      activityId,
      processed,
      analyzed,
      failed,
      valuationsCreated,
      pendingManualReview,
      implemented: analyzed > 0,
      reason: failureReasons.size ? [...failureReasons].join('; ') : undefined,
    };
  }

  private async getDocumentForAnalysis(submission: Submission) {
    if (!submission.fileName) return null;
    if (submission.fileStorageKey && this.documentRepository) {
      return {
        mimeType: submission.fileMimeType ?? 'application/pdf',
        content: await this.documentRepository.read(submission.fileStorageKey),
      };
    }

    const legacySubmission = await this.submissions
      .createQueryBuilder('submission')
      .addSelect('submission.fileBase64')
      .where('submission.id = :submissionId', { submissionId: submission.id })
      .getOne();
    if (!legacySubmission?.fileBase64) {
      throw new NotFoundException('No se encontró el contenido del PDF entregado');
    }
    return {
      mimeType: legacySubmission.fileMimeType ?? 'application/pdf',
      content: Buffer.from(legacySubmission.fileBase64, 'base64'),
    };
  }
}
