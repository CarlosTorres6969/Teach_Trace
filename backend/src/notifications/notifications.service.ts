import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Notification, NotificationType } from '../entities/notification.entity';
import { PushSubscriptionEntity } from '../entities/push-subscription.entity';
import { User } from '../entities/user.entity';
import {
  NotificationChannel,
  NotificationEventType,
} from '../entities/notification-preference.entity';
import { NotificationPreferencesService } from '../notification-preferences/notification-preferences.service';
import { SavePushSubscriptionDto } from './notifications.dto';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const webpush = require('web-push') as typeof import('web-push');

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly vapidConfigured: boolean;

  constructor(
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
    @InjectRepository(PushSubscriptionEntity)
    private readonly pushSubscriptions: Repository<PushSubscriptionEntity>,
    private readonly preferencesService: NotificationPreferencesService,
    private readonly config: ConfigService,
  ) {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.config.get<string>('VAPID_SUBJECT', 'mailto:teachtrace@unah.edu.hn');

    if (publicKey && privateKey) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.vapidConfigured = true;
    } else {
      this.logger.warn('VAPID keys no configuradas — push deshabilitado');
      this.vapidConfigured = false;
    }
  }

  getVapidPublicKey(): string {
    return this.config.get<string>('VAPID_PUBLIC_KEY', '');
  }

  // ─── Suscripciones push ──────────────────────────────────────────────────────

  async saveSubscription(user: User, dto: SavePushSubscriptionDto) {
    const existing = await this.pushSubscriptions.findOne({
      where: { endpoint: dto.endpoint },
    });
    if (existing) {
      existing.p256dh = dto.p256dh;
      existing.auth = dto.auth;
      return this.pushSubscriptions.save(existing);
    }
    return this.pushSubscriptions.save(
      this.pushSubscriptions.create({ user, ...dto }),
    );
  }

  async deleteSubscription(user: User, endpoint: string) {
    await this.pushSubscriptions.delete({ user: { id: user.id }, endpoint });
  }

  // ─── Notificaciones in-app ───────────────────────────────────────────────────

  async listForUser(userId: number) {
    const cutoff = new Date(Date.now() - THIRTY_DAYS_MS);
    const items = await this.notifications.find({
      where: { user: { id: userId }, createdAt: LessThan(new Date()) },
      order: { createdAt: 'DESC' },
    });
    // Filtrar últimos 30 días en memoria (LessThan no admite date calc directo en sqljs)
    return items
      .filter((n) => n.createdAt >= cutoff)
      .map((n) => this.toResponse(n));
  }

  async unreadCount(userId: number): Promise<number> {
    const cutoff = new Date(Date.now() - THIRTY_DAYS_MS);
    const all = await this.notifications.find({
      where: { user: { id: userId }, read: false },
    });
    return all.filter((n) => n.createdAt >= cutoff).length;
  }

  async markRead(userId: number, notificationId: number) {
    const notification = await this.notifications.findOne({
      where: { id: notificationId, user: { id: userId } },
    });
    if (!notification) throw new NotFoundException('Notificación no encontrada');
    notification.read = true;
    return this.toResponse(await this.notifications.save(notification));
  }

  async markAllRead(userId: number) {
    const unread = await this.notifications.find({
      where: { user: { id: userId }, read: false },
    });
    if (!unread.length) return [];
    await this.notifications.save(unread.map((n) => ({ ...n, read: true })));
    return this.listForUser(userId);
  }

  // ─── Dispatch (llamado por otros servicios) ──────────────────────────────────

  async dispatchGradePublished(student: User, activityTitle: string, activityId: number) {
    const title = 'Tu entrega ha sido calificada';
    const message = `Tu entrega de "${activityTitle}" ya tiene retroalimentación del docente.`;

    // Persistir notificación in-app siempre
    const notification = await this.notifications.save(
      this.notifications.create({
        user: student,
        type: NotificationType.GRADE_PUBLISHED,
        title,
        message,
        read: false,
        activityId,
      }),
    );

    // Enviar push solo si el estudiante lo tiene habilitado
    const pushEnabled = await this.preferencesService.isChannelEnabled(
      student.id,
      NotificationEventType.GRADE_PUBLISHED,
      NotificationChannel.PUSH,
    );

    if (pushEnabled && this.vapidConfigured) {
      await this.sendPush(student.id, title, message, `/student/activities/${activityId}/results`);
    }

    return notification;
  }

  // ─── Internos ────────────────────────────────────────────────────────────────

  private async sendPush(userId: number, title: string, body: string, url: string) {
    const subscriptions = await this.pushSubscriptions.find({
      where: { user: { id: userId } },
    });
    if (!subscriptions.length) return;

    const payload = JSON.stringify({ title, body, url });

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          );
        } catch (error: unknown) {
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            // Suscripción expirada — limpiar
            await this.pushSubscriptions.delete({ id: sub.id });
            this.logger.log(`Suscripción push eliminada (expirada): ${sub.endpoint}`);
          } else {
            this.logger.error(`Error enviando push a ${sub.endpoint}: ${String(error)}`);
          }
        }
      }),
    );
  }

  private toResponse(n: Notification) {
    return {
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      read: n.read,
      activityId: n.activityId,
      createdAt: n.createdAt,
    };
  }
}
