import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Activity } from './activity.entity';
import { Submission } from './submission.entity';
import { User } from './user.entity';

export enum AiMessageRole {
  STUDENT = 'student',
  AI = 'ai',
}

@Entity('ai_conversations')
@Index(['student', 'activity'], { unique: true })
export class AiConversation {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  student: User;

  @ManyToOne(() => Activity, { eager: true, onDelete: 'CASCADE' })
  activity: Activity;

  @OneToOne(() => Submission, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn()
  submission: Submission | null;

  @OneToMany(() => AiMessage, (message) => message.conversation, {
    cascade: true,
  })
  messages: AiMessage[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('ai_messages')
@Index(['conversation', 'sequence'], { unique: true })
export class AiMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => AiConversation, (conversation) => conversation.messages, {
    onDelete: 'CASCADE',
  })
  conversation: AiConversation;

  @Column({ type: 'simple-enum', enum: AiMessageRole })
  role: AiMessageRole;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'integer' })
  sequence: number;

  @CreateDateColumn()
  createdAt: Date;
}
