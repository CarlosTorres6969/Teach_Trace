import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Activity } from '../entities/activity.entity';
import { AiDeclaration } from '../entities/ai-declaration.entity';
import { Logbook } from '../entities/logbook.entity';
import { Rubric } from '../entities/rubric.entity';
import { Submission } from '../entities/submission.entity';
import { User } from '../entities/user.entity';
import { AssociateRubricDto, CreateActivityDto, CreateRubricDto, UpdateLearningOutcomesDto } from './teacher.dto';

@Injectable()
export class TeacherService {
  constructor(
    @InjectRepository(Activity) private readonly activities: Repository<Activity>,
    @InjectRepository(Rubric) private readonly rubrics: Repository<Rubric>,
    @InjectRepository(Submission) private readonly submissions: Repository<Submission>,
    @InjectRepository(Logbook) private readonly logbooks: Repository<Logbook>,
    @InjectRepository(AiDeclaration) private readonly declarations: Repository<AiDeclaration>,
  ) {}

  async listActivities(teacherId: number) {
    const activities = await this.activities.find({
      where: { teacher: { id: teacherId } },
      relations: { rubric: true },
      order: { id: 'DESC' },
    });
    return activities.map((activity) => this.activityResponse(activity));
  }

  async createActivity(teacher: User, input: CreateActivityDto) {
    const activity = await this.activities.save(
      this.activities.create({ ...input, learningOutcomes: [], teacher, rubric: null }),
    );
    return this.activityResponse(activity);
  }

  async updateLearningOutcomes(teacherId: number, activityId: number, input: UpdateLearningOutcomesDto) {
    const activity = await this.ownedActivity(teacherId, activityId);
    activity.learningOutcomes = input.learningOutcomes.map((outcome) => outcome.trim()).filter(Boolean);
    return this.activityResponse(await this.activities.save(activity));
  }

  async listRubrics(teacherId: number) {
    const rubrics = await this.rubrics.find({ where: { teacher: { id: teacherId } }, order: { id: 'DESC' } });
    return rubrics.map((rubric) => this.rubricResponse(rubric));
  }

  async createRubric(teacher: User, input: CreateRubricDto) {
    const rubric = await this.rubrics.save(
      this.rubrics.create({ name: input.name, criteria: input.criteria, teacher, activity: null }),
    );
    return this.rubricResponse(rubric);
  }

  async associateRubric(teacherId: number, activityId: number, input: AssociateRubricDto) {
    const activity = await this.ownedActivity(teacherId, activityId);
    const rubric = await this.rubrics.findOne({
      where: { id: input.rubricId, teacher: { id: teacherId } },
    });
    if (!rubric) throw new NotFoundException('La rúbrica no existe o no pertenece al docente');
    const alreadyAssigned = await this.rubrics.findOne({ where: { activity: { id: activityId } } });
    if (alreadyAssigned && alreadyAssigned.id !== rubric.id) {
      alreadyAssigned.activity = null;
      await this.rubrics.save(alreadyAssigned);
    }
    rubric.activity = activity;
    await this.rubrics.save(rubric);
    return this.activityResponse(await this.ownedActivity(teacherId, activityId, true));
  }

  async listSubmissions(teacherId: number, activityId: number) {
    await this.ownedActivity(teacherId, activityId);
    const submissions = await this.submissions.find({
      where: { activity: { id: activityId } },
      order: { submittedAt: 'DESC' },
    });
    return submissions.map((submission) => ({
      id: submission.id,
      student: { id: submission.student.id, name: submission.student.name, email: submission.student.email },
      status: submission.status,
      submittedAt: submission.submittedAt,
    }));
  }

  async getSubmission(teacherId: number, submissionId: number) {
    const submission = await this.submissions.findOne({ where: { id: submissionId } });
    if (!submission) throw new NotFoundException('La entrega no existe');
    await this.ownedActivity(teacherId, submission.activity.id);
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
      student: { id: submission.student.id, name: submission.student.name, email: submission.student.email },
      status: submission.status,
      submittedAt: submission.submittedAt,
      productText: submission.productText,
      productUrl: submission.productUrl,
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
            purpose: declaration.purpose,
            promptSummary: declaration.promptSummary,
          }
        : null,
    };
  }

  private async ownedActivity(teacherId: number, activityId: number, includeRubric = false) {
    const activity = await this.activities.findOne({
      where: { id: activityId, teacher: { id: teacherId } },
      relations: includeRubric ? { rubric: true } : undefined,
    });
    if (!activity) throw new NotFoundException('La actividad no existe o no pertenece al docente');
    return activity;
  }

  private rubricResponse(rubric: Rubric) {
    return { id: rubric.id, name: rubric.name, criteria: rubric.criteria };
  }

  private activityResponse(activity: Activity) {
    return {
      id: activity.id,
      title: activity.title,
      subject: activity.subject,
      dueDate: activity.dueDate,
      activityType: activity.activityType,
      learningOutcomes: activity.learningOutcomes,
      rubric: activity.rubric ? this.rubricResponse(activity.rubric) : null,
    };
  }
}
