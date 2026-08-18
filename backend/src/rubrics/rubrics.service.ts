import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivitiesService } from '../activities/activities.service';
import { Activity } from '../entities/activity.entity';
import { Rubric } from '../entities/rubric.entity';
import { User } from '../entities/user.entity';
import { AssociateRubricDto, CreateRubricDto } from './rubrics.dto';

@Injectable()
export class RubricsService {
  constructor(
    @InjectRepository(Rubric) private readonly rubrics: Repository<Rubric>,
    @InjectRepository(Activity) private readonly activities: Repository<Activity>,
    private readonly activitiesService: ActivitiesService,
  ) {}

  listForTeacher(teacherId: number) {
    return this.rubrics.find({ where: { teacher: { id: teacherId } }, order: { id: 'DESC' } });
  }

  create(teacher: User, input: CreateRubricDto) {
    return this.rubrics.save(
      this.rubrics.create({ name: input.name.trim(), criteria: input.criteria, teacher, activity: null }),
    );
  }

  async associate(teacherId: number, activityId: number, input: AssociateRubricDto) {
    const activity = await this.activitiesService.ownedActivity(teacherId, activityId);
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
    return this.activitiesService.ownedActivity(teacherId, activityId, true);
  }
}
