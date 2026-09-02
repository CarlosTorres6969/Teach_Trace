import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivitiesService } from '../activities/activities.service';
import { AiDeclaration } from '../entities/ai-declaration.entity';
import { Submission } from '../entities/submission.entity';
import { User } from '../entities/user.entity';
import {
  normalizeAiDeclarationText,
  UpdateAiDeclarationDto,
} from './update-ai-declaration.dto';

@Injectable()
export class AiDeclarationsService {
  constructor(
    @InjectRepository(AiDeclaration) private readonly declarations: Repository<AiDeclaration>,
    @InjectRepository(Submission) private readonly submissions: Repository<Submission>,
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
      usageLevel: declaration?.usageLevel ?? null,
      detectedUsageLevel: declaration?.detectedUsageLevel ?? null,
      usageDiscrepancy: declaration?.usageDiscrepancy ?? false,
      purpose: declaration?.purpose ?? '',
      promptSummary: declaration?.promptSummary ?? '',
      updatedAt: declaration?.updatedAt ?? null,
    };
  }

  async update(student: User, activityId: number, input: UpdateAiDeclarationDto) {
    const toolName = normalizeAiDeclarationText(input.toolName);
    if (!toolName) {
      throw new BadRequestException('El nombre de la herramienta de IA es obligatorio');
    }
    const purpose = normalizeAiDeclarationText(input.purpose);
    if (!purpose) {
      throw new BadRequestException('El propósito del uso de IA es obligatorio');
    }
    const promptSummary = normalizeAiDeclarationText(input.promptSummary);
    if (!promptSummary) {
      throw new BadRequestException('El resumen de prompts es obligatorio');
    }
    const activity = await this.activitiesService.getForStudent(student.id, activityId);
    const submission = await this.submissions.findOne({
      where: { student: { id: student.id }, activity: { id: activityId } },
    });
    if (submission?.submittedAt) {
      throw new ConflictException(
        'La declaración forma parte de una entrega. Actualiza la entrega completa para modificarla',
      );
    }
    let declaration = await this.declarations.findOne({
      where: { student: { id: student.id }, activity: { id: activityId } },
    });
    if (!declaration) {
      declaration = this.declarations.create({
        student,
        activity,
        detectedUsageLevel: null,
        usageDiscrepancy: false,
      });
    }
    declaration.toolName = toolName;
    declaration.usageLevel = input.usageLevel;
    declaration.purpose = purpose;
    declaration.promptSummary = promptSummary;
    declaration.usageDiscrepancy =
      declaration.detectedUsageLevel !== null &&
      declaration.detectedUsageLevel !== declaration.usageLevel;
    await this.declarations.save(declaration);
    return this.getForStudent(student.id, activityId);
  }
}
