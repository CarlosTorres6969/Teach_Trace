import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AcademicClass } from './class.entity';
import { ForumPost } from './forum-post.entity';
import { User } from './user.entity';

@Entity('forum_threads')
export class ForumThread {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => AcademicClass, { eager: true, onDelete: 'CASCADE' })
  academicClass: AcademicClass;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  author: User;

  @Column({ length: 160 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ default: false })
  pinned: boolean;

  @Column({ default: false })
  resolved: boolean;

  @OneToMany(() => ForumPost, (post) => post.thread)
  posts: ForumPost[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
