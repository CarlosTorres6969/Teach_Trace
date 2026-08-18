import { Injectable } from '@nestjs/common';
import { ActivitiesService } from '../activities/activities.service';
import { CreateActivityDto, UpdateLearningOutcomesDto } from '../activities/activities.dto';
import { ClassesService } from '../classes/classes.service';
import { CreateClassDto } from '../classes/classes.dto';
import { Activity } from '../entities/activity.entity';
import { Rubric } from '../entities/rubric.entity';
import { User } from '../entities/user.entity';
import { RubricsService } from '../rubrics/rubrics.service';
import { AssociateRubricDto, CreateRubricDto } from '../rubrics/rubrics.dto';
import { SubmissionsService } from '../submissions/submissions.service';

@Injectable()
export class TeacherService {
  constructor(
    private readonly classesService: ClassesService,
    private readonly activitiesService: ActivitiesService,
    private readonly rubricsService: RubricsService,
    private readonly submissionsService: SubmissionsService,
  ) {}

  listClasses(teacherId: number) {
    return this.classesService.listForTeacher(teacherId);
  }

  createClass(teacher: User, input: CreateClassDto) {
    return this.classesService.create(teacher, input);
  }

  enrollStudent(teacherId: number, classId: number, email: string) {
    return this.classesService.enrollStudent(teacherId, classId, email);
  }

  listEnrollments(teacherId: number, classId: number) {
    return this.classesService.listEnrollments(teacherId, classId);
  }

  async listActivities(teacherId: number) {
    const activities = await this.activitiesService.listForTeacher(teacherId);
    return activities.map((activity) => this.activityResponse(activity));
  }

  async createActivity(teacher: User, input: CreateActivityDto) {
    const activity = await this.activitiesService.create(teacher, input);
    return this.activityResponse(activity);
  }

  async updateLearningOutcomes(teacherId: number, activityId: number, input: UpdateLearningOutcomesDto) {
    return this.activityResponse(
      await this.activitiesService.updateLearningOutcomes(teacherId, activityId, input),
    );
  }

  async listRubrics(teacherId: number) {
    const rubrics = await this.rubricsService.listForTeacher(teacherId);
    return rubrics.map((rubric) => this.rubricResponse(rubric));
  }

  async createRubric(teacher: User, input: CreateRubricDto) {
    const rubric = await this.rubricsService.create(teacher, input);
    return this.rubricResponse(rubric);
  }

  async associateRubric(teacherId: number, activityId: number, input: AssociateRubricDto) {
    return this.activityResponse(
      await this.rubricsService.associate(teacherId, activityId, input),
    );
  }

  async listSubmissions(teacherId: number, activityId: number) {
    return this.submissionsService.listForTeacher(teacherId, activityId);
  }

  async getSubmission(teacherId: number, submissionId: number) {
    return this.submissionsService.getForTeacher(teacherId, submissionId);
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
      evaluationPhase: activity.evaluationPhase,
      manualEvaluationRequired: activity.manualEvaluationRequired,
      learningOutcomes: activity.learningOutcomes,
      academicClass: activity.academicClass
        ? {
            id: activity.academicClass.id,
            name: activity.academicClass.name,
            code: activity.academicClass.code,
          }
        : null,
      rubric: activity.rubric ? this.rubricResponse(activity.rubric) : null,
    };
  }
}
