import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';

export enum NotificationType {
  GRADE_PUBLISHED = 'GRADE_PUBLISHED',
  AI_ANALYSIS_READY = 'AI_ANALYSIS_READY',
}

// Compatibilidad de almacenamiento con funciones históricas ya retiradas.
// Estos valores no se exponen como tipos activos en la API actual.
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

  /** Solo compatibilidad con SQLite antiguo: estas referencias no existen en
   * producción ni participan en lecturas, inserciones o actualizaciones. */
  @Column({ type: 'integer', nullable: true, select: false, insert: false, update: false })
  conversationId: number | null;

  @Column({ type: 'integer', nullable: true, select: false, insert: false, update: false })
  forumThreadId: number | null;

  @Column({ type: 'integer', nullable: true, select: false, insert: false, update: false })
  classId: number | null;

  @CreateDateColumn()
  createdAt: Date;
}
