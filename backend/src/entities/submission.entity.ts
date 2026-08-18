import { Column, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Activity } from './activity.entity';
import { User } from './user.entity';

export enum SubmissionStatus {
  NOT_SUBMITTED = 'not_submitted',
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  EVALUATED = 'evaluated',
}

export enum EvaluationStatus {
  NOT_REQUESTED = 'not_requested',
  PENDING = 'pending',
  MANUAL_REQUIRED = 'manual_required',
  ANALYZED = 'analyzed',
  VALIDATED = 'validated',
}

@Entity('submissions')
@Index(['student', 'activity'], { unique: true })
export class Submission {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  student: User;

  @ManyToOne(() => Activity, { eager: true, onDelete: 'CASCADE' })
  activity: Activity;

  @Column({ type: 'simple-enum', enum: SubmissionStatus, default: SubmissionStatus.NOT_SUBMITTED })
  status: SubmissionStatus;

  @Column({ type: 'simple-enum', enum: EvaluationStatus, default: EvaluationStatus.NOT_REQUESTED })
  evaluationStatus: EvaluationStatus;

  @Column({ default: false })
  manualReviewRequired: boolean;

  @Column({ type: 'datetime', nullable: true })
  submittedAt: Date | null;

  @Column({ type: 'text', default: '' })
  productText: string;

  @Column({ default: '' })
  productUrl: string;

  @Column({ type: 'varchar', nullable: true })
  fileName: string | null;

  @Column({ type: 'varchar', nullable: true })
  fileMimeType: string | null;

  @Column({ type: 'text', nullable: true, select: false })
  fileBase64: string | null;
}
