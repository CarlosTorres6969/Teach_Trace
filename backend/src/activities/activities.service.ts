import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ClassesService } from '../classes/classes.service';
import { Activity } from '../entities/activity.entity';
import { Enrollment } from '../entities/enrollment.entity';
import { User } from '../entities/user.entity';
import { CreateActivityDto, UpdateLearningOutcomesDto } from './activities.dto';

@Injectable()
export class ActivitiesService {
  constructor(
    @InjectRepository(Activity) private readonly activities: Repository<Activity>,
    @InjectRepository(Enrollment) private readonly enrollments: Repository<Enrollment>,
    private readonly classesService: ClassesService,
  ) {}

  async listForStudent(studentId: number) {
    const enrollments = await this.enrollments.find({
      where: { student: { id: studentId }, active: true },
    });
    const classIds = enrollments.map((enrollment) => enrollment.academicClass.id);
    if (!classIds.length) return [];
    return this.activities.find({
      where: { academicClass: { id: In(classIds) } },
      relations: { rubric: true },
      order: { id: 'ASC' },
    });
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
        learningOutcomes: [],
        teacher,
        academicClass,
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
    activity.learningOutcomes = input.learningOutcomes.map((outcome) => outcome.trim()).filter(Boolean);
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
}
