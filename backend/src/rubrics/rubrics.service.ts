import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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
    return this.rubrics.find({
      where: { teacher: { id: teacherId } },
      relations: { activity: true },
      order: { id: 'DESC' },
    });
  }

  create(teacher: User, input: CreateRubricDto) {
    const criteria = input.criteria.map((criterion) => ({
      name: criterion.name.trim(),
      dimension: criterion.dimension.trim(),
      descriptors: {
        level1: criterion.descriptors.level1.trim(),
        level2: criterion.descriptors.level2.trim(),
        level3: criterion.descriptors.level3.trim(),
        level4: criterion.descriptors.level4.trim(),
      },
    }));
    return this.rubrics.save(
      this.rubrics.create({ name: input.name.trim(), criteria, teacher, activity: null }),
    );
  }

  async associate(teacherId: number, activityId: number, input: AssociateRubricDto) {
    const activity = await this.activitiesService.ownedActivity(teacherId, activityId);
    const rubric = await this.rubrics.findOne({
      where: { id: input.rubricId, teacher: { id: teacherId } },
      relations: { activity: true },
    });
    if (!rubric) throw new NotFoundException('La rúbrica no existe o no pertenece al docente');

    if (rubric.activity?.id === activityId) {
      return this.activitiesService.ownedActivity(teacherId, activityId, true);
    }
    if (rubric.activity) {
      throw new ConflictException('La rúbrica ya está asociada a otra actividad');
    }

    const alreadyAssigned = await this.rubrics.findOne({ where: { activity: { id: activityId } } });
    const rubricsToSave = [rubric];
    if (alreadyAssigned && alreadyAssigned.id !== rubric.id) {
      alreadyAssigned.activity = null;
      rubricsToSave.unshift(alreadyAssigned);
    }
    rubric.activity = activity;
    await this.rubrics.save(rubricsToSave);
    return this.activitiesService.ownedActivity(teacherId, activityId, true);
  }
}
