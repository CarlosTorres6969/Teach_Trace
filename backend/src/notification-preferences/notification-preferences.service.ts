import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  NotificationChannel,
  NotificationEventType,
  NotificationPreference,
} from '../entities/notification-preference.entity';
import { User } from '../entities/user.entity';
import { UpdateNotificationPreferencesDto } from './notification-preferences.dto';

export const NOTIFICATION_EVENT_TYPES = Object.values(NotificationEventType);
export const DEFAULT_NOTIFICATION_CHANNELS = Object.values(NotificationChannel);

@Injectable()
export class NotificationPreferencesService {
  constructor(
    @InjectRepository(NotificationPreference)
    private readonly preferences: Repository<NotificationPreference>,
    private readonly dataSource: DataSource,
  ) {}

  async getForUser(user: User) {
    const stored = await this.preferences.find({ where: { user: { id: user.id } } });
    const byEvent = new Map(stored.map((preference) => [preference.eventType, preference]));
    const missing = NOTIFICATION_EVENT_TYPES.filter((eventType) => !byEvent.has(eventType));

    if (missing.length) {
      const created = await this.preferences.save(
        missing.map((eventType) =>
          this.preferences.create({
            user,
            eventType,
            channels: [...DEFAULT_NOTIFICATION_CHANNELS],
          }),
        ),
      );
      created.forEach((preference) => byEvent.set(preference.eventType, preference));
    }

    return NOTIFICATION_EVENT_TYPES.map((eventType) =>
      this.response(byEvent.get(eventType) as NotificationPreference),
    );
  }

  async updateForUser(user: User, input: UpdateNotificationPreferencesDto) {
    this.validateCompletePreferences(input);

    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(NotificationPreference);
      const stored = await repository.find({ where: { user: { id: user.id } } });
      const byEvent = new Map(stored.map((preference) => [preference.eventType, preference]));

      const updates = input.preferences.map((item) => {
        const preference =
          byEvent.get(item.eventType) ?? repository.create({ user, eventType: item.eventType });
        preference.channels = [...item.channels];
        return preference;
      });
      await repository.save(updates);
    });

    return this.getForUser(user);
  }

  async isChannelEnabled(
    userId: number,
    eventType: NotificationEventType,
    channel: NotificationChannel,
  ) {
    const preference = await this.preferences.findOne({
      where: { user: { id: userId }, eventType },
    });
    return preference ? preference.channels.includes(channel) : true;
  }

  private validateCompletePreferences(input: UpdateNotificationPreferencesDto) {
    if (input.preferences.length !== NOTIFICATION_EVENT_TYPES.length) {
      throw new BadRequestException('Debe configurar todos los tipos de evento');
    }

    const receivedEvents = new Set<NotificationEventType>();
    for (const preference of input.preferences) {
      if (receivedEvents.has(preference.eventType)) {
        throw new BadRequestException('No puede repetir un tipo de evento');
      }
      receivedEvents.add(preference.eventType);
      if (!preference.channels.includes(NotificationChannel.IN_APP)) {
        throw new BadRequestException(
          'Las notificaciones en plataforma deben permanecer activas para todos los eventos',
        );
      }
    }

    if (NOTIFICATION_EVENT_TYPES.some((eventType) => !receivedEvents.has(eventType))) {
      throw new BadRequestException('Debe configurar todos los tipos de evento');
    }
  }

  private response(preference: NotificationPreference) {
    return {
      eventType: preference.eventType,
      channels: preference.channels,
    };
  }
}
