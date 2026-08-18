import {
  BeforeInsert,
  BeforeUpdate,
  Check,
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Activity } from './activity.entity';
import { User } from './user.entity';

@Entity('ai_declarations')
@Index(['student', 'activity'], { unique: true })
@Check(`"usageLevel" BETWEEN 1 AND 3`)
@Check(`"detectedUsageLevel" IS NULL OR "detectedUsageLevel" BETWEEN 1 AND 3`)
export class AiDeclaration {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  student: User;

  @ManyToOne(() => Activity, { eager: true, onDelete: 'CASCADE' })
  activity: Activity;

  @Column({ default: '' })
  toolName: string;

  @Column({ type: 'integer', default: 1 })
  usageLevel: number;

  @Column({ type: 'integer', nullable: true })
  detectedUsageLevel: number | null;

  @Column({ default: false })
  usageDiscrepancy: boolean;

  @Column({ type: 'text', default: '' })
  purpose: string;

  @Column({ type: 'text', default: '' })
  promptSummary: string;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  updateUsageDiscrepancy() {
    this.usageDiscrepancy =
      this.detectedUsageLevel !== null && this.detectedUsageLevel !== this.usageLevel;
  }
}
