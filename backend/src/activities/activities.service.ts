import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { ClassesService } from '../classes/classes.service';
import { Activity } from '../entities/activity.entity';
import { AiConversation } from '../entities/ai-conversation.entity';
import { AiDeclaration } from '../entities/ai-declaration.entity';
import { Enrollment } from '../entities/enrollment.entity';
import { Logbook } from '../entities/logbook.entity';
import { Notification } from '../entities/notification.entity';
import { Submission } from '../entities/submission.entity';
import { User } from '../entities/user.entity';
import {
  CreateActivityDto,
  MAX_LEARNING_OUTCOMES,
  MAX_LEARNING_OUTCOME_LENGTH,
  UpdateLearningOutcomesDto,
} from './activities.dto';

export type StudentActivityFilter = 'week' | 'month' | 'all';

@Injectable()
export class ActivitiesService {
  constructor(
    @InjectRepository(Activity) private readonly activities: Repository<Activity>,
    @InjectRepository(Enrollment) private readonly enrollments: Repository<Enrollment>,
    private readonly classesService: ClassesService,
  ) {}

  async listForStudent(studentId: number, filter: StudentActivityFilter = 'all') {
    if (!['week', 'month', 'all'].includes(filter)) {
      throw new BadRequestException('El filtro debe ser week, month o all');
    }
    const enrollments = await this.enrollments.find({
      where: { student: { id: studentId }, active: true },
    });
    const classIds = enrollments.map((enrollment) => enrollment.academicClass.id);
    if (!classIds.length) return [];
    const dueDateRange = this.dateRange(filter);
    return this.activities.find({
      where: {
        academicClass: { id: In(classIds) },
        published: true,
        ...(dueDateRange ? { dueDate: Between(dueDateRange.from, dueDateRange.to) } : {}),
      },
      relations: { rubric: true },
      order: { dueDate: 'ASC', id: 'ASC' },
    });
  }

  async markViewed(studentId: number, activityId: number) {
    const activity = await this.getForStudent(studentId, activityId);
    activity.viewedByStudents ??= [];
    if (!activity.viewedByStudents.some((view) => view.studentId === studentId)) {
      activity.viewedByStudents.push({ studentId, viewedAt: new Date().toISOString() });
      await this.activities.save(activity);
    }
    return { activityId, viewed: true };
  }

  async getForStudent(studentId: number, activityId: number) {
    const activity = await this.activities.findOne({ where: { id: activityId, published: true } });
    if (
      !activity ||
      !activity.academicClass ||
      !(await this.classesService.isStudentEnrolled(studentId, activity.academicClass.id))
    ) {
      throw new NotFoundException('La actividad no existe o no está asignada al estudiante');
    }
    return activity;
  }

  async listForTeacher(teacherId: number) {
    return this.activities.find({
      where: { teacher: { id: teacherId } },
      relations: { rubric: true },
      order: { id: 'DESC' },
    });
  }

  async create(teacher: User, input: CreateActivityDto) {
    const academicClass = await this.classesService.ownedClass(teacher.id, input.classId);
    return this.activities.save(
      this.activities.create({
        title: input.title.trim(),
        subject: academicClass.subject,
        dueDate: input.dueDate,
        activityType: input.activityType.trim(),
        evaluationPhase: input.evaluationPhase,
        learningOutcomes: [],
        teacher,
        academicClass,
        manualEvaluationRequired: false,
        published: false,
        weight: input.weight ?? 1.0,
        rubric: null,
      }),
    );
  }

  async updateLearningOutcomes(
    teacherId: number,
    activityId: number,
    input: UpdateLearningOutcomesDto,
  ) {
    const activity = await this.ownedActivity(teacherId, activityId);
    const learningOutcomes = input.learningOutcomes.map((outcome) => outcome.trim());
    if (
      learningOutcomes.length < 1 ||
      learningOutcomes.length > MAX_LEARNING_OUTCOMES ||
      learningOutcomes.some(
        (outcome) => !outcome || outcome.length > MAX_LEARNING_OUTCOME_LENGTH,
      )
    ) {
      throw new BadRequestException('Los resultados de aprendizaje no son válidos');
    }
    activity.learningOutcomes = learningOutcomes;
    return this.activities.save(activity);
  }

  async ownedActivity(teacherId: number, activityId: number, includeRubric = false) {
    const activity = await this.activities.findOne({
      where: { id: activityId, teacher: { id: teacherId } },
      relations: includeRubric ? { rubric: true } : undefined,
    });
    if (!activity) throw new NotFoundException('La actividad no existe o no pertenece al docente');
    return activity;
  }

  async setManualEvaluationRequired(activity: Activity, required: boolean) {
    activity.manualEvaluationRequired = required;
    return this.activities.save(activity);
  }

  async publish(teacherId: number, activityId: number) {
    const activity = await this.ownedActivity(teacherId, activityId, true);
    if (!activity.rubric?.criteria?.length) {
      throw new BadRequestException('Asocia una rúbrica antes de publicar la actividad');
    }
    activity.published = true;
    return this.activities.save(activity);
  }

  async remove(teacherId: number, activityId: number) {
    const activity = await this.ownedActivity(teacherId, activityId);
    const manager = this.activities.manager;
    const studentWorkRepositories = [Submission, Logbook, AiDeclaration, AiConversation];
    const studentWorkExists = await Promise.all(
      studentWorkRepositories.map((entity) =>
        manager.getRepository(entity).exist({ where: { activity: { id: activityId } } }),
      ),
    );

    if (studentWorkExists.some(Boolean)) {
      throw new ConflictException(
        'No se puede eliminar la actividad porque ya contiene avances o entregas de estudiantes',
      );
    }

    await manager.transaction(async (transaction) => {
      await transaction.getRepository(Notification).delete({ activityId });
      await transaction.getRepository(Activity).delete(activity.id);
    });

    return { id: activity.id, deleted: true };
  }

  private dateRange(filter: StudentActivityFilter) {
    if (filter === 'all') return null;
    const now = new Date();
    const from = this.toDateOnly(now);
    const end = new Date(now);
    if (filter === 'week') {
      end.setDate(now.getDate() + 6);
    } else {
      end.setMonth(now.getMonth() + 1, 0);
    }
    return { from, to: this.toDateOnly(end) };
  }

  private toDateOnly(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
