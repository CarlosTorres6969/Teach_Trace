import { Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Activity } from './activity.entity';
import { User } from './user.entity';

export type RubricCriterion = {
  name: string;
  dimension: string;
  descriptors: { level1: string; level2: string; level3: string; level4: string };
};

@Entity('rubrics')
export class Rubric {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'simple-json', default: '[]' })
  criteria: RubricCriterion[];

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  teacher: User;

  @OneToOne(() => Activity, (activity) => activity.rubric, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn()
  activity: Activity | null;
}
