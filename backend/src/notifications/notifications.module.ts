import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Notification } from '../entities/notification.entity';
import { PushSubscriptionEntity } from '../entities/push-subscription.entity';
import { NotificationPreferencesModule } from '../notification-preferences/notification-preferences.module';
import { NotificationsController, VapidController } from './notifications.controller';
import { NotificationsSseService } from './notifications-sse.service';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([Notification, PushSubscriptionEntity]),
    NotificationPreferencesModule,
  ],
  controllers: [NotificationsController, VapidController],
  providers: [NotificationsService, NotificationsSseService],
  exports: [NotificationsService, NotificationsSseService],
})
export class NotificationsModule {}
