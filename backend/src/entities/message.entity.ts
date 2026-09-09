import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Conversation } from './conversation.entity';
import { User } from './user.entity';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Conversation, { eager: false, onDelete: 'CASCADE' })
  conversation: Conversation;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  sender: User;

  @Column({ type: 'text', length: 1000 })
  body: string;

  @CreateDateColumn()
  createdAt: Date;
}
