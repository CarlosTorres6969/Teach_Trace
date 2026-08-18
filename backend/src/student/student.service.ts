import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Activity } from '../entities/activity.entity';
import { AiDeclaration } from '../entities/ai-declaration.entity';
import { Logbook } from '../entities/logbook.entity';
import { Submission, SubmissionStatus } from '../entities/submission.entity';
import { User } from '../entities/user.entity';
import { UpdateLogbookDto } from './update-logbook.dto';
import { UpdateAiDeclarationDto } from './update-ai-declaration.dto';
import { SubmitProductDto } from './submit-product.dto';

@Injectable()
export class StudentService {
  constructor(
    @InjectRepository(Activity) private readonly activities: Repository<Activity>,
    @InjectRepository(Logbook) private readonly logbooks: Repository<Logbook>,
    @InjectRepository(Submission) private readonly submissions: Repository<Submission>,
    @InjectRepository(AiDeclaration) private readonly declarations: Repository<AiDeclaration>,
  ) {}

  async listActivities(studentId: number) {
    const activities = await this.activities.find({ order: { id: 'ASC' } });
    return Promise.all(
      activities.map(async (activity) => {
        const submission = await this.submissions.findOne({
          where: { activity: { id: activity.id }, student: { id: studentId } },
        });
        return {
          id: activity.id,
          title: activity.title,
          subject: activity.subject,
          submissionStatus: submission?.status ?? SubmissionStatus.NOT_SUBMITTED,
        };
      }),
    );
  }

  async getLogbook(studentId: number, activityId: number) {
    const activity = await this.activities.findOne({ where: { id: activityId } });
    if (!activity) throw new NotFoundException('La actividad no existe');
    const logbook = await this.logbooks.findOne({
      where: { student: { id: studentId }, activity: { id: activityId } },
    });
    if (!logbook) {
      return {
        id: null,
        activity: { id: activity.id, title: activity.title },
        initialIdeas: '',
        prompts: '',
        validationsAndDecisions: '',
        finalReflection: '',
        updatedAt: null,
      };
    }
    return this.logbookResponse(logbook);
  }

  async updateLogbook(student: User, activityId: number, input: UpdateLogbookDto) {
    const activity = await this.activities.findOne({ where: { id: activityId } });
    if (!activity) throw new NotFoundException('La actividad no existe');

    let logbook = await this.logbooks.findOne({
      where: { student: { id: student.id }, activity: { id: activityId } },
    });
    if (!logbook) logbook = this.logbooks.create({ student, activity });
    Object.assign(logbook, input);
    return this.logbookResponse(await this.logbooks.save(logbook));
  }

  async getSubmissionStatus(studentId: number, activityId: number) {
    const activity = await this.activities.findOne({ where: { id: activityId } });
    if (!activity) throw new NotFoundException('La actividad no existe');
    const submission = await this.submissions.findOne({
      where: { student: { id: studentId }, activity: { id: activityId } },
    });
    return {
      activity: { id: activity.id, title: activity.title },
      status: submission?.status ?? SubmissionStatus.NOT_SUBMITTED,
      submittedAt: submission?.submittedAt ?? null,
      productText: submission?.productText ?? '',
      productUrl: submission?.productUrl ?? '',
    };
  }

  async getAiDeclaration(studentId: number, activityId: number) {
    const activity = await this.activities.findOne({ where: { id: activityId } });
    if (!activity) throw new NotFoundException('La actividad no existe');
    const declaration = await this.declarations.findOne({
      where: { student: { id: studentId }, activity: { id: activityId } },
    });
    return {
      activity: { id: activity.id, title: activity.title },
      toolName: declaration?.toolName ?? '',
      usageLevel: declaration?.usageLevel ?? 1,
      purpose: declaration?.purpose ?? '',
      promptSummary: declaration?.promptSummary ?? '',
      updatedAt: declaration?.updatedAt ?? null,
    };
  }

  async updateAiDeclaration(student: User, activityId: number, input: UpdateAiDeclarationDto) {
    const activity = await this.activities.findOne({ where: { id: activityId } });
    if (!activity) throw new NotFoundException('La actividad no existe');
    let declaration = await this.declarations.findOne({
      where: { student: { id: student.id }, activity: { id: activityId } },
    });
    if (!declaration) declaration = this.declarations.create({ student, activity });
    Object.assign(declaration, input);
    await this.declarations.save(declaration);
    return this.getAiDeclaration(student.id, activityId);
  }

  async submitProduct(student: User, activityId: number, input: SubmitProductDto) {
    const activity = await this.activities.findOne({ where: { id: activityId } });
    if (!activity) throw new NotFoundException('La actividad no existe');
    let submission = await this.submissions.findOne({
      where: { student: { id: student.id }, activity: { id: activityId } },
    });
    if (!submission) submission = this.submissions.create({ student, activity });
    submission.productText = input.productText.trim();
    submission.productUrl = input.productUrl?.trim() ?? '';
    submission.status = SubmissionStatus.SUBMITTED;
    submission.submittedAt = new Date();
    await this.submissions.save(submission);
    return this.getSubmissionStatus(student.id, activityId);
  }

  private logbookResponse(logbook: Logbook) {
    return {
      id: logbook.id,
      activity: { id: logbook.activity.id, title: logbook.activity.title },
      initialIdeas: logbook.initialIdeas,
      prompts: logbook.prompts,
      validationsAndDecisions: logbook.validationsAndDecisions,
      finalReflection: logbook.finalReflection,
      updatedAt: logbook.updatedAt,
    };
  }
}
