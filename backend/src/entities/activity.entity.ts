import { Column, Entity, ManyToOne, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Rubric } from './rubric.entity';
import { AcademicClass } from './class.entity';
import { User } from './user.entity';

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

  @Column({ type: 'simple-json', default: '[]' })
  learningOutcomes: string[];

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  teacher: User;

  @ManyToOne(() => AcademicClass, (academicClass) => academicClass.activities, {
    eager: true,
    nullable: true,
    onDelete: 'CASCADE',
  })
  academicClass: AcademicClass | null;

  @OneToOne(() => Rubric, (rubric) => rubric.activity, { nullable: true })
  rubric: Rubric | null;
}
