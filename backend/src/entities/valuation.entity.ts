import { Column, Entity, Index, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Activity } from './activity.entity';
import { Submission } from './submission.entity';

@Entity('valuations')
@Index(['submission', 'dimension'], { unique: true })
export class Valuation {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Activity, { eager: true, onDelete: 'CASCADE' })
  activity: Activity;

  @ManyToOne(() => Submission, { eager: true, onDelete: 'CASCADE' })
  submission: Submission;

  @Column()
  dimension: string;

  @Column({ type: 'integer', nullable: true })
  aiValue: number | null;

  @Column({ type: 'text', default: '' })
  aiExplanation: string;

  @Column({ type: 'integer', nullable: true })
  teacherValue: number | null;

  @Column({ type: 'text', default: '' })
  teacherComment: string;

  @Column({ default: false })
  confirmed: boolean;

  @UpdateDateColumn()
  updatedAt: Date;
}
