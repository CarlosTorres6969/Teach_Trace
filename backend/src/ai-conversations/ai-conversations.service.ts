import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ActivitiesService } from '../activities/activities.service';
import {
  AiConversation,
  AiMessage,
  AiMessageRole,
} from '../entities/ai-conversation.entity';
import { Submission } from '../entities/submission.entity';
import { User } from '../entities/user.entity';
import { UpdateAiConversationDto } from './ai-conversations.dto';

@Injectable()
export class AiConversationsService {
  constructor(
    @InjectRepository(AiConversation)
    private readonly conversations: Repository<AiConversation>,
    @InjectRepository(AiMessage)
    private readonly messages: Repository<AiMessage>,
    @InjectRepository(Submission)
    private readonly submissions: Repository<Submission>,
    private readonly dataSource: DataSource,
    private readonly activitiesService: ActivitiesService,
  ) {}

  async getForStudent(studentId: number, activityId: number) {
    await this.activitiesService.getForStudent(studentId, activityId);
    const conversation = await this.conversations.findOne({
      where: { student: { id: studentId }, activity: { id: activityId } },
      relations: { messages: true },
    });
    return this.response(conversation);
  }

  async saveForStudent(
    student: User,
    activityId: number,
    input: UpdateAiConversationDto,
  ) {
    const activity = await this.activitiesService.getForStudent(student.id, activityId);
    const normalized = input.messages.map((message, index) => ({
      role: message.role,
      content: message.content.trim(),
      sequence: index,
    }));
    if (normalized.some((message) => !message.content)) {
      throw new BadRequestException('Los mensajes de la conversación no pueden estar vacíos');
    }

    const conversation = await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(AiConversation);
      const messageRepository = manager.getRepository(AiMessage);
      const submissionRepository = manager.getRepository(Submission);
      let current = await repository.findOne({
        where: { student: { id: student.id }, activity: { id: activityId } },
      });
      if (!current) {
        current = repository.create({ student, activity, submission: null });
        current = await repository.save(current);
      }
      current.submission = await submissionRepository.findOne({
        where: { student: { id: student.id }, activity: { id: activityId } },
      });
      await messageRepository.delete({ conversation: { id: current.id } });
      const savedMessages = await messageRepository.save(
        normalized.map((message) =>
          messageRepository.create({ conversation: current, ...message }),
        ),
      );
      current.messages = savedMessages;
      return current;
    });

    return this.response(conversation);
  }

  async attachToSubmission(studentId: number, activityId: number, submission: Submission) {
    const conversation = await this.conversations.findOne({
      where: { student: { id: studentId }, activity: { id: activityId } },
    });
    if (!conversation) return;
    conversation.submission = submission;
    await this.conversations.save(conversation);
  }

  async getForTeacher(teacherId: number, submissionId: number) {
    const submission = await this.submissions.findOne({
      where: { id: submissionId },
      relations: { activity: true, student: true },
    });
    if (!submission) throw new NotFoundException('La entrega no existe');
    await this.activitiesService.ownedActivity(teacherId, submission.activity.id);
    const conversation = await this.conversations.findOne({
      where: { student: { id: submission.student.id }, activity: { id: submission.activity.id } },
      relations: { messages: true },
    });
    return this.response(conversation);
  }

  async exportForTeacher(teacherId: number, submissionId: number) {
    const conversation = await this.getForTeacher(teacherId, submissionId);
    if (!conversation) throw new NotFoundException('No existe una conversación registrada');
    const lines = conversation.messages.map((message) =>
      `[${message.role === AiMessageRole.STUDENT ? 'Estudiante' : 'IA'}] ${message.content}`,
    );
    return {
      name: `conversacion-ia-${submissionId}.txt`,
      content: Buffer.from(lines.join('\r\n\r\n'), 'utf8'),
    };
  }

  private response(conversation: AiConversation | null) {
    if (!conversation) return null;
    return {
      id: conversation.id,
      submissionId: conversation.submission?.id ?? null,
      messages: [...(conversation.messages ?? [])]
        .sort((a, b) => a.sequence - b.sequence)
        .map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          sequence: message.sequence,
          createdAt: message.createdAt,
        })),
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }
}
