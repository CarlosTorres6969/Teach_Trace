import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ActivitiesService } from '../activities/activities.service';
import { AiEngineService } from '../ai-engine/ai-engine.service';
import { AiDeclaration } from '../entities/ai-declaration.entity';
import { Logbook } from '../entities/logbook.entity';
import { Submission, SubmissionStatus } from '../entities/submission.entity';
import { User } from '../entities/user.entity';
import { SubmitEvidenceDto } from './submit-evidence.dto';

export type UploadedAcademicFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Injectable()
export class SubmissionsService {
  constructor(
    @InjectRepository(Submission) private readonly submissions: Repository<Submission>,
    @InjectRepository(Logbook) private readonly logbooks: Repository<Logbook>,
    @InjectRepository(AiDeclaration) private readonly declarations: Repository<AiDeclaration>,
    private readonly dataSource: DataSource,
    private readonly activitiesService: ActivitiesService,
    private readonly aiEngine: AiEngineService,
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
    const productText = input.productText.trim();
    const productUrl = input.productUrl?.trim() ?? '';
    if (!productText && !productUrl && !file && !existingSubmission?.fileName) {
      throw new BadRequestException('Debe entregar texto, un enlace o un archivo');
    }

    await this.dataSource.transaction(async (manager) => {
      const submissionRepository = manager.getRepository(Submission);
      const declarationRepository = manager.getRepository(AiDeclaration);
      let submission = await submissionRepository.findOne({
        where: { student: { id: student.id }, activity: { id: activityId } },
      });
      if (!submission) {
        submission = submissionRepository.create({
          student,
          activity,
          fileName: null,
          fileMimeType: null,
          fileBase64: null,
        });
      }
      submission.productText = productText;
      submission.productUrl = productUrl;
      submission.status = SubmissionStatus.SUBMITTED;
      submission.submittedAt = new Date();
      if (file) {
        submission.fileName = file.originalname;
        submission.fileMimeType = file.mimetype || 'application/octet-stream';
        submission.fileBase64 = file.buffer.toString('base64');
      }
      await submissionRepository.save(submission);

      let declaration = await declarationRepository.findOne({
        where: { student: { id: student.id }, activity: { id: activityId } },
      });
      if (!declaration) {
        declaration = declarationRepository.create({
          student,
          activity,
          detectedUsageLevel: null,
        });
      }
      declaration.toolName = input.toolName.trim();
      declaration.usageLevel = input.usageLevel;
      declaration.purpose = input.purpose.trim();
      declaration.promptSummary = input.promptSummary.trim();
      await declarationRepository.save(declaration);
    });

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
      submittedAt: submission.submittedAt,
    }));
  }

  async getForTeacher(teacherId: number, submissionId: number) {
    const submission = await this.submissions.findOne({ where: { id: submissionId } });
    if (!submission) throw new NotFoundException('La entrega no existe');
    await this.activitiesService.ownedActivity(teacherId, submission.activity.id);
    const [logbook, declaration] = await Promise.all([
      this.logbooks.findOne({
        where: { student: { id: submission.student.id }, activity: { id: submission.activity.id } },
      }),
      this.declarations.findOne({
        where: { student: { id: submission.student.id }, activity: { id: submission.activity.id } },
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
      submittedAt: submission.submittedAt,
      productText: submission.productText,
      productUrl: submission.productUrl,
      fileName: submission.fileName,
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
            purpose: declaration.purpose,
            promptSummary: declaration.promptSummary,
          }
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
    if (!submission.fileBase64 || !submission.fileName) {
      throw new NotFoundException('La entrega no contiene un archivo');
    }
    return {
      name: submission.fileName,
      mimeType: submission.fileMimeType ?? 'application/octet-stream',
      content: Buffer.from(submission.fileBase64, 'base64'),
    };
  }

  async evaluateActivity(teacherId: number, activityId: number) {
    const activity = await this.activitiesService.ownedActivity(teacherId, activityId, true);
    const submissions = await this.submissions.find({ where: { activity: { id: activityId } } });
    let pendingManualReview = 0;
    for (const submission of submissions) {
      const [logbook, declaration] = await Promise.all([
        this.logbooks.findOne({
          where: { student: { id: submission.student.id }, activity: { id: activityId } },
        }),
        this.declarations.findOne({
          where: { student: { id: submission.student.id }, activity: { id: activityId } },
        }),
      ]);
      const result = await this.aiEngine.analyzeEvidence({
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
        product: {
          text: submission.productText,
          url: submission.productUrl,
          fileName: submission.fileName,
        },
        rubric: activity.rubric?.criteria ?? [],
      });
      if (!result.implemented) pendingManualReview += 1;
    }
    return {
      activityId,
      processed: submissions.length,
      valuationsCreated: 0,
      pendingManualReview,
      implemented: false,
    };
  }
}
