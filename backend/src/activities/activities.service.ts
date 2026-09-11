import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { ClassesService } from '../classes/classes.service';
import { Activity } from '../entities/activity.entity';
import { Enrollment } from '../entities/enrollment.entity';
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
    const activity = await this.activities.findOne({ where: { id: activityId } });
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
