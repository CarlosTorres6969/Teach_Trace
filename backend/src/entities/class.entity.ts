import { Column, Entity, Index, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Activity } from './activity.entity';
import { Enrollment } from './enrollment.entity';
import { User } from './user.entity';

@Entity('classes')
export class AcademicClass {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  subject: string;

  @Index({ unique: true })
  @Column()
  code: string;

  @Column()
  period: string;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  teacher: User;

  @OneToMany(() => Enrollment, (enrollment) => enrollment.academicClass)
  enrollments: Enrollment[];

  @OneToMany(() => Activity, (activity) => activity.academicClass)
  activities: Activity[];
}
