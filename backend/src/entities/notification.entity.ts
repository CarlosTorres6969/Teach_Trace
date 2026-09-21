import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';

export enum NotificationType {
  GRADE_PUBLISHED = 'GRADE_PUBLISHED',
  AI_ANALYSIS_READY = 'AI_ANALYSIS_READY',
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'simple-enum', enum: NotificationType })
  type: NotificationType;

  @Column()
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ default: false })
  read: boolean;

  @Column({ type: 'integer', nullable: true })
  activityId: number | null;

  @CreateDateColumn()
  createdAt: Date;
}
