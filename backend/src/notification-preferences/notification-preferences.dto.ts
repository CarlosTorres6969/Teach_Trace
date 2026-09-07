import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  ValidateNested,
} from 'class-validator';
import {
  NotificationChannel,
  NotificationEventType,
} from '../entities/notification-preference.entity';

export class NotificationPreferenceItemDto {
  @IsEnum(NotificationEventType)
  eventType: NotificationEventType;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(NotificationChannel, { each: true })
  channels: NotificationChannel[];
}

export class UpdateNotificationPreferencesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => NotificationPreferenceItemDto)
  preferences: NotificationPreferenceItemDto[];
}
