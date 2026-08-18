import { Column, Entity, ManyToOne, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Rubric } from './rubric.entity';
import { AcademicClass } from './class.entity';
import { User } from './user.entity';

export enum ActivityPhase {
  BASELINE = 'baseline',
  PILOT = 'pilot',
}

@Entity('activities')
export class Activity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column()
  subject: string;

  @Column({ type: 'date' })
  dueDate: string;

  @Column()
  activityType: string;

  @Column({ type: 'simple-enum', enum: ActivityPhase, default: ActivityPhase.PILOT })
  evaluationPhase: ActivityPhase;

  @Column({ type: 'simple-json', default: '[]' })
  learningOutcomes: string[];

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  teacher: User;

  @ManyToOne(() => AcademicClass, (academicClass) => academicClass.activities, {
    eager: true,
    nullable: false,
    onDelete: 'CASCADE',
  })
  academicClass: AcademicClass;

  @Column({ default: false })
  manualEvaluationRequired: boolean;

  @OneToOne(() => Rubric, (rubric) => rubric.activity, { nullable: true })
  rubric: Rubric | null;
}
