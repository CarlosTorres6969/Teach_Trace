import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';

export enum NotificationType {
  GRADE_PUBLISHED = 'GRADE_PUBLISHED',
  AI_ANALYSIS_READY = 'AI_ANALYSIS_READY',
}

// TypeORM debe aceptar estos valores al recrear tablas de bases antiguas,
// aunque ya no formen parte de las funciones vigentes de la aplicacion.
const NOTIFICATION_STORAGE_TYPES = [
  ...Object.values(NotificationType),
  'MESSAGE_RECEIVED',
  'FORUM_REPLY',
];

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'simple-enum', enum: NOTIFICATION_STORAGE_TYPES })
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
