import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Submission } from './submission.entity';
import { User } from './user.entity';

export enum ConversationStatus {
  OPEN = 'open',
  RESOLVED = 'resolved',
}

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  student: User;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  teacher: User;

  @ManyToOne(() => Submission, { eager: true, nullable: true, onDelete: 'SET NULL' })
  submission: Submission | null;

  @Column({ length: 160 })
  subject: string;

  @Column({ type: 'simple-enum', enum: ConversationStatus, default: ConversationStatus.OPEN })
  status: ConversationStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
