import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum NotificationEventType {
  NEW_ACTIVITY = 'NEW_ACTIVITY',
  GRADE_PUBLISHED = 'GRADE_PUBLISHED',
  ACTIVITY_DUE_SOON = 'ACTIVITY_DUE_SOON',
  SUBMISSION_STATUS_CHANGED = 'SUBMISSION_STATUS_CHANGED',
  AI_ANALYSIS_READY = 'AI_ANALYSIS_READY',
}

// Valores históricos admitidos solo para mantener bases locales anteriores.
const NOTIFICATION_EVENT_STORAGE_TYPES = [
  ...Object.values(NotificationEventType),
  'MESSAGE_RECEIVED',
  'FORUM_REPLY',
];

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  PUSH = 'PUSH',
  IN_APP = 'IN_APP',
}

@Entity('notification_preferences')
@Index(['user', 'eventType'], { unique: true })
export class NotificationPreference {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'simple-enum', enum: NOTIFICATION_EVENT_STORAGE_TYPES })
  eventType: NotificationEventType;

  @Column({ type: 'simple-json' })
  channels: NotificationChannel[];

  @UpdateDateColumn()
  updatedAt: Date;
}
