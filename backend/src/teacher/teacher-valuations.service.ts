import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivitiesService } from '../activities/activities.service';
import { Submission, SubmissionStatus } from '../entities/submission.entity';
import { Valuation } from '../entities/valuation.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { ConfirmValuationDto } from './confirm-valuation.dto';

@Injectable()
export class TeacherValuationsService {
  constructor(
    @InjectRepository(Valuation)
    private readonly valuations: Repository<Valuation>,
    @InjectRepository(Submission)
    private readonly submissions: Repository<Submission>,
    private readonly activitiesService: ActivitiesService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async confirmValuation(
    teacherId: number,
    submissionId: number,
    valuationId: number,
    dto: ConfirmValuationDto,
  ) {
    const submission = await this.loadSubmission(submissionId);
    await this.activitiesService.ownedActivity(teacherId, submission.activity.id);

    const valuation = await this.valuations.findOne({
      where: { id: valuationId, submission: { id: submissionId } },
    });
    if (!valuation) throw new NotFoundException('La valoración no existe');

    valuation.teacherValue = dto.teacherValue;
    valuation.teacherComment = dto.teacherComment?.trim() ?? '';
    valuation.confirmed = true;
    await this.valuations.save(valuation);

    // Cerrar si todos los criterios están confirmados
    const allValuations = await this.valuations.find({
      where: { submission: { id: submissionId } },
    });
    const allConfirmed = allValuations.length > 0 && allValuations.every((v) => v.confirmed);
    if (allConfirmed) {
      await this.closeEvaluation(submission);
    }

    return {
      id: valuation.id,
      criterion: valuation.criterion,
      dimension: valuation.dimension,
      aiValue: valuation.aiValue,
      teacherValue: valuation.teacherValue,
      teacherComment: valuation.teacherComment,
      confirmed: valuation.confirmed,
    };
  }

  async closeEvaluationManually(teacherId: number, submissionId: number) {
    const submission = await this.loadSubmission(submissionId);
    await this.activitiesService.ownedActivity(teacherId, submission.activity.id);
    await this.closeEvaluation(submission);
    return { submissionId, status: SubmissionStatus.EVALUATED };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async loadSubmission(submissionId: number): Promise<Submission> {
    const submission = await this.submissions.findOne({
      where: { id: submissionId },
      relations: { activity: true, student: true },
    });
    if (!submission) throw new NotFoundException('La entrega no existe');
    return submission;
  }

  private async closeEvaluation(submission: Submission) {
    // Idempotente: solo notificar la primera vez que cambia a EVALUATED
    const alreadyNotified = submission.notificationSentAt !== null;

    submission.status = SubmissionStatus.EVALUATED;
    if (!alreadyNotified) {
      submission.notificationSentAt = new Date();
    }
    await this.submissions.save(submission);

    if (!alreadyNotified) {
      await this.notificationsService.dispatchGradePublished(
        submission.student,
        submission.activity.title,
        submission.activity.id,
      );
    }
  }
}
