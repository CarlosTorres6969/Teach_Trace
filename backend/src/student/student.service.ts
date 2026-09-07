import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivitiesService } from '../activities/activities.service';
import { AiDeclarationsService } from '../ai-declarations/ai-declarations.service';
import { Submission, SubmissionStatus } from '../entities/submission.entity';
import { Valuation } from '../entities/valuation.entity';
import { User } from '../entities/user.entity';
import { LogbooksService } from '../logbooks/logbooks.service';
import { SubmissionsService, UploadedAcademicFile } from '../submissions/submissions.service';
import { SubmitEvidenceDto } from '../submissions/submit-evidence.dto';
import { UpdateLogbookDto } from '../logbooks/update-logbook.dto';
import { UpdateAiDeclarationDto } from '../ai-declarations/update-ai-declaration.dto';

@Injectable()
export class StudentService {
  constructor(
    private readonly activitiesService: ActivitiesService,
    private readonly logbooksService: LogbooksService,
    private readonly declarationsService: AiDeclarationsService,
    private readonly submissionsService: SubmissionsService,
    @InjectRepository(Submission)
    private readonly submissions: Repository<Submission>,
    @InjectRepository(Valuation)
    private readonly valuations: Repository<Valuation>,
  ) {}

  async listActivities(studentId: number) {
    const activities = await this.activitiesService.listForStudent(studentId);
    return Promise.all(
      activities.map(async (activity) => {
        const submission = await this.submissionsService.getStatus(studentId, activity.id);
        return {
          id: activity.id,
          title: activity.title,
          subject: activity.subject,
          evaluationPhase: activity.evaluationPhase,
          academicClass: activity.academicClass
            ? {
                id: activity.academicClass.id,
                name: activity.academicClass.name,
                code: activity.academicClass.code,
              }
            : null,
          submissionStatus: submission.status,
        };
      }),
    );
  }

  getLogbook(studentId: number, activityId: number) {
    return this.logbooksService.getForStudent(studentId, activityId);
  }

  updateLogbook(student: User, activityId: number, input: UpdateLogbookDto) {
    return this.logbooksService.update(student, activityId, input);
  }

  getSubmissionStatus(studentId: number, activityId: number) {
    return this.submissionsService.getStatus(studentId, activityId);
  }

  getAiDeclaration(studentId: number, activityId: number) {
    return this.declarationsService.getForStudent(studentId, activityId);
  }

  updateAiDeclaration(student: User, activityId: number, input: UpdateAiDeclarationDto) {
    return this.declarationsService.update(student, activityId, input);
  }

  submitEvidence(
    student: User,
    activityId: number,
    input: SubmitEvidenceDto,
    file?: UploadedAcademicFile,
  ) {
    return this.submissionsService.submit(student, activityId, input, file);
  }

  async getResults(studentId: number, activityId: number) {
    const activity = await this.activitiesService.getForStudent(studentId, activityId);
    const submission = await this.submissions.findOne({
      where: { student: { id: studentId }, activity: { id: activityId } },
    });

    const valuationList = submission
      ? await this.valuations.find({ where: { submission: { id: submission.id } } })
      : [];

    const confirmedValues = valuationList
      .filter((v) => v.teacherValue !== null)
      .map((v) => v.teacherValue as number);

    const finalScore =
      confirmedValues.length > 0
        ? confirmedValues.reduce((a, b) => a + b, 0) / confirmedValues.length
        : null;

    return {
      activity: { id: activity.id, title: activity.title },
      status: submission?.status ?? SubmissionStatus.NOT_SUBMITTED,
      valuations: valuationList.map((v) => ({
        id: v.id,
        criterion: v.criterion,
        dimension: v.dimension,
        aiValue: v.aiValue,
        teacherValue: v.teacherValue,
        teacherComment: v.teacherComment,
        confirmed: v.confirmed,
      })),
      finalScore,
      feedback: '',
    };
  }
}
