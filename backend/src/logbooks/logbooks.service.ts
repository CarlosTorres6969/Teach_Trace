import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivitiesService } from '../activities/activities.service';
import { Logbook } from '../entities/logbook.entity';
import { User } from '../entities/user.entity';
import { UpdateLogbookDto } from './update-logbook.dto';

@Injectable()
export class LogbooksService {
  constructor(
    @InjectRepository(Logbook) private readonly logbooks: Repository<Logbook>,
    private readonly activitiesService: ActivitiesService,
  ) {}

  async getForStudent(studentId: number, activityId: number) {
    const activity = await this.activitiesService.getForStudent(studentId, activityId);
    const logbook = await this.logbooks.findOne({
      where: { student: { id: studentId }, activity: { id: activityId } },
    });
    if (!logbook) {
      return {
        id: null,
        activity: { id: activity.id, title: activity.title },
        initialIdeas: '',
        prompts: '',
        validationsAndDecisions: '',
        finalReflection: '',
        updatedAt: null,
      };
    }
    return this.response(logbook);
  }

  async update(student: User, activityId: number, input: UpdateLogbookDto) {
    const activity = await this.activitiesService.getForStudent(student.id, activityId);
    let logbook = await this.logbooks.findOne({
      where: { student: { id: student.id }, activity: { id: activityId } },
    });
    if (!logbook) logbook = this.logbooks.create({ student, activity });
    Object.assign(logbook, input);
    return this.response(await this.logbooks.save(logbook));
  }

  private response(logbook: Logbook) {
    return {
      id: logbook.id,
      activity: { id: logbook.activity.id, title: logbook.activity.title },
      initialIdeas: logbook.initialIdeas,
      prompts: logbook.prompts,
      validationsAndDecisions: logbook.validationsAndDecisions,
      finalReflection: logbook.finalReflection,
      updatedAt: logbook.updatedAt,
    };
  }
}
