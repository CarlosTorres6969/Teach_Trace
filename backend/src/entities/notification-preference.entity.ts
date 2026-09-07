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
  MESSAGE_RECEIVED = 'MESSAGE_RECEIVED',
  ACTIVITY_DUE_SOON = 'ACTIVITY_DUE_SOON',
  SUBMISSION_STATUS_CHANGED = 'SUBMISSION_STATUS_CHANGED',
}

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

  @Column({ type: 'simple-enum', enum: NotificationEventType })
  eventType: NotificationEventType;

  @Column({ type: 'simple-json' })
  channels: NotificationChannel[];

  @UpdateDateColumn()
  updatedAt: Date;
}
