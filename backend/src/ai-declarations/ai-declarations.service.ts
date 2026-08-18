import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivitiesService } from '../activities/activities.service';
import { AiDeclaration } from '../entities/ai-declaration.entity';
import { User } from '../entities/user.entity';
import { UpdateAiDeclarationDto } from './update-ai-declaration.dto';

@Injectable()
export class AiDeclarationsService {
  constructor(
    @InjectRepository(AiDeclaration) private readonly declarations: Repository<AiDeclaration>,
    private readonly activitiesService: ActivitiesService,
  ) {}

  async getForStudent(studentId: number, activityId: number) {
    const activity = await this.activitiesService.getForStudent(studentId, activityId);
    const declaration = await this.declarations.findOne({
      where: { student: { id: studentId }, activity: { id: activityId } },
    });
    return {
      activity: { id: activity.id, title: activity.title },
      toolName: declaration?.toolName ?? '',
      usageLevel: declaration?.usageLevel ?? 1,
      detectedUsageLevel: declaration?.detectedUsageLevel ?? null,
      purpose: declaration?.purpose ?? '',
      promptSummary: declaration?.promptSummary ?? '',
      updatedAt: declaration?.updatedAt ?? null,
    };
  }

  async update(student: User, activityId: number, input: UpdateAiDeclarationDto) {
    const activity = await this.activitiesService.getForStudent(student.id, activityId);
    let declaration = await this.declarations.findOne({
      where: { student: { id: student.id }, activity: { id: activityId } },
    });
    if (!declaration) {
      declaration = this.declarations.create({ student, activity, detectedUsageLevel: null });
    }
    Object.assign(declaration, input);
    await this.declarations.save(declaration);
    return this.getForStudent(student.id, activityId);
  }
}
