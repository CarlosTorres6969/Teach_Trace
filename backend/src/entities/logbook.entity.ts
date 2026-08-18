import { Column, Entity, Index, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Activity } from './activity.entity';
import { User } from './user.entity';

@Entity('logbooks')
@Index(['student', 'activity'], { unique: true })
export class Logbook {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  student: User;

  @ManyToOne(() => Activity, { eager: true, onDelete: 'CASCADE' })
  activity: Activity;

  @Column({ type: 'text', default: '' })
  initialIdeas: string;

  @Column({ type: 'text', default: '' })
  prompts: string;

  @Column({ type: 'text', default: '' })
  validationsAndDecisions: string;

  @Column({ type: 'text', default: '' })
  finalReflection: string;

  @UpdateDateColumn()
  updatedAt: Date;
}
