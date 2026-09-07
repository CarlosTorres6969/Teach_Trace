import {
  BadRequestException,
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
    // Verificar que la entrega existe y pertenece a una actividad del docente
    const submission = await this.submissions.findOne({
      where: { id: submissionId },
    });
    if (!submission) throw new NotFoundException('La entrega no existe');

    await this.activitiesService.ownedActivity(teacherId, submission.activity.id);

    const valuation = await this.valuations.findOne({
      where: { id: valuationId, submission: { id: submissionId } },
    });
    if (!valuation) throw new NotFoundException('La valoración no existe');

    valuation.teacherValue = dto.teacherValue;
    valuation.teacherComment = dto.teacherComment?.trim() ?? '';
    valuation.confirmed = true;
    await this.valuations.save(valuation);

    // Verificar si TODAS las valoraciones de esta entrega están confirmadas
    const allValuations = await this.valuations.find({
      where: { submission: { id: submissionId } },
    });
    const allConfirmed = allValuations.length > 0 && allValuations.every((v) => v.confirmed);

    if (allConfirmed) {
      await this.closeEvaluation(submission, teacherId);
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
    const submission = await this.submissions.findOne({
      where: { id: submissionId },
    });
    if (!submission) throw new NotFoundException('La entrega no existe');
    await this.activitiesService.ownedActivity(teacherId, submission.activity.id);

    const allValuations = await this.valuations.find({
      where: { submission: { id: submissionId } },
    });
    if (!allValuations.length) {
      throw new BadRequestException(
        'No hay valoraciones registradas para cerrar la evaluación',
      );
    }

    await this.closeEvaluation(submission, teacherId);
    return { submissionId, status: SubmissionStatus.EVALUATED };
  }

  private async closeEvaluation(submission: Submission, _teacherId: number) {
    submission.status = SubmissionStatus.EVALUATED;
    await this.submissions.save(submission);

    // Disparar notificación push + in-app al estudiante
    await this.notificationsService.dispatchGradePublished(
      submission.student,
      submission.activity.title,
      submission.activity.id,
    );
  }
}
