import { Check, Column, Entity, Index, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Activity } from './activity.entity';
import { Submission } from './submission.entity';

@Entity('valuations')
@Index(['submission', 'criterion'], { unique: true })
@Check(`"aiValue" IS NULL OR "aiValue" BETWEEN 1 AND 4`)
@Check(`"teacherValue" IS NULL OR "teacherValue" BETWEEN 1 AND 4`)
export class Valuation {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Activity, { eager: true, onDelete: 'CASCADE' })
  activity: Activity;

  @ManyToOne(() => Submission, { eager: true, onDelete: 'CASCADE' })
  submission: Submission;

  @Column()
  dimension: string;

  @Column()
  criterion: string;

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
