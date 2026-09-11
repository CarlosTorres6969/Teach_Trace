import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ForumThread } from './forum-thread.entity';
import { User } from './user.entity';

@Entity('forum_posts')
export class ForumPost {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ForumThread, (thread) => thread.posts, {
    eager: true,
    onDelete: 'CASCADE',
  })
  thread: ForumThread;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  author: User;

  @ManyToOne(() => ForumPost, { nullable: true, onDelete: 'CASCADE' })
  parentPost: ForumPost | null;

  @Column({ type: 'text' })
  body: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
