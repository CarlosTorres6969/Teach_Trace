import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { AcademicClass } from './class.entity';
import { User } from './user.entity';

@Entity('enrollments')
@Index(['student', 'academicClass'], { unique: true })
export class Enrollment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  student: User;

  @ManyToOne(() => AcademicClass, (academicClass) => academicClass.enrollments, {
    eager: true,
    onDelete: 'CASCADE',
  })
  academicClass: AcademicClass;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn()
  enrolledAt: Date;
}
