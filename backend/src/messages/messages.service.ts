import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassesService } from '../classes/classes.service';
import { Conversation, ConversationStatus } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';
import { Submission } from '../entities/submission.entity';
import { User, UserRole } from '../entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateConversationDto, ReplyMessageDto } from './messages.dto';

const WEEKLY_LIMIT = 3;
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversations: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messages: Repository<Message>,
    @InjectRepository(Submission)
    private readonly submissions: Repository<Submission>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly classesService: ClassesService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ─── Estudiante: crear conversación ──────────────────────────────────────────

  async createConversation(student: User, dto: CreateConversationDto) {
    // Verificar que el teacher existe y es docente
    const teacher = await this.users.findOne({
      where: { id: dto.teacherId, role: UserRole.TEACHER },
    });
    if (!teacher) throw new NotFoundException('El docente no existe');

    // Validar que el estudiante pertenece a al menos una clase del docente
    const shared = await this.classesService.sharedClassExists(student.id, teacher.id);
    if (!shared) {
      throw new ForbiddenException(
        'Solo puedes enviar mensajes a docentes de tus clases',
      );
    }

    // Rate limit: máx 3 conversaciones nuevas por semana
    const weekAgo = new Date(Date.now() - ONE_WEEK_MS);
    const recentCount = await this.conversations.count({
      where: { student: { id: student.id } },
    });
    const recentConvs = await this.conversations.find({
      where: { student: { id: student.id } },
      order: { createdAt: 'DESC' },
    });
    const thisWeek = recentConvs.filter((c) => c.createdAt >= weekAgo).length;
    if (thisWeek >= WEEKLY_LIMIT) {
      throw new BadRequestException(
        `Puedes crear máximo ${WEEKLY_LIMIT} conversaciones nuevas por semana`,
      );
    }
    void recentCount; // usado solo para futuro paginado

    // Verificar entrega si se especifica
    let submission: Submission | null = null;
    if (dto.submissionId) {
      submission = await this.submissions.findOne({ where: { id: dto.submissionId } });
      if (!submission || submission.student.id !== student.id) {
        throw new NotFoundException('La entrega no existe o no te pertenece');
      }
    }

    const conversation = await this.conversations.save(
      this.conversations.create({ student, teacher, submission, subject: dto.subject }),
    );

    await this.messages.save(
      this.messages.create({ conversation, sender: student, body: dto.body }),
    );

    await this.notificationsService.dispatchMessageReceived(
      teacher,
      student.name,
      dto.subject,
      conversation.id,
    );

    return this.conversationResponse(conversation, student);
  }

  // ─── Listados ─────────────────────────────────────────────────────────────────

  async listForStudent(studentId: number) {
    const convs = await this.conversations.find({
      where: { student: { id: studentId } },
      order: { updatedAt: 'DESC' },
    });
    return Promise.all(convs.map((c) => this.conversationResponse(c, { id: studentId } as User)));
  }

  async listForTeacher(teacherId: number) {
    const convs = await this.conversations.find({
      where: { teacher: { id: teacherId } },
      order: { updatedAt: 'DESC' },
    });
    return Promise.all(convs.map((c) => this.conversationResponse(c, { id: teacherId } as User)));
  }

  // ─── Hilo ─────────────────────────────────────────────────────────────────────

  async getThread(conversationId: number, userId: number) {
    const conversation = await this.getOwnedConversation(conversationId, userId);
    const thread = await this.messages.find({
      where: { conversation: { id: conversationId } },
      order: { createdAt: 'ASC' },
    });
    return {
      ...this.conversationResponse(conversation, { id: userId } as User),
      messages: thread.map((m) => this.messageResponse(m)),
    };
  }

  // ─── Responder ────────────────────────────────────────────────────────────────

  async reply(conversationId: number, sender: User, dto: ReplyMessageDto) {
    const conversation = await this.getOwnedConversation(conversationId, sender.id);

    if (conversation.status === ConversationStatus.RESOLVED) {
      throw new BadRequestException('Esta conversación está cerrada');
    }

    const message = await this.messages.save(
      this.messages.create({ conversation, sender, body: dto.body }),
    );

    // Actualizar updatedAt de la conversación
    await this.conversations.save({ ...conversation, updatedAt: new Date() });

    // Notificar al otro participante
    const recipient =
      sender.id === conversation.student.id ? conversation.teacher : conversation.student;
    await this.notificationsService.dispatchMessageReceived(
      recipient,
      sender.name,
      conversation.subject,
      conversation.id,
    );

    return this.messageResponse(message);
  }

  // ─── Resolver (solo docente) ──────────────────────────────────────────────────

  async resolve(conversationId: number, teacherId: number) {
    const conversation = await this.conversations.findOne({
      where: { id: conversationId, teacher: { id: teacherId } },
    });
    if (!conversation) throw new NotFoundException('Conversación no encontrada');

    conversation.status = ConversationStatus.RESOLVED;
    await this.conversations.save(conversation);
    return this.conversationResponse(conversation, { id: teacherId } as User);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  private async getOwnedConversation(conversationId: number, userId: number) {
    const conversation = await this.conversations.findOne({
      where: { id: conversationId },
    });
    if (
      !conversation ||
      (conversation.student.id !== userId && conversation.teacher.id !== userId)
    ) {
      throw new NotFoundException('Conversación no encontrada');
    }
    return conversation;
  }

  private conversationResponse(conversation: Conversation, requestingUser: Pick<User, 'id'>) {
    const isStudent = conversation.student.id === requestingUser.id;
    const other = isStudent ? conversation.teacher : conversation.student;
    return {
      id: conversation.id,
      subject: conversation.subject,
      status: conversation.status,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      with: { id: other.id, name: other.name, role: other.role },
      submissionId: conversation.submission?.id ?? null,
    };
  }

  private messageResponse(message: Message) {
    return {
      id: message.id,
      body: message.body,
      createdAt: message.createdAt,
      sender: {
        id: message.sender.id,
        name: message.sender.name,
        role: message.sender.role,
      },
    };
  }
}
