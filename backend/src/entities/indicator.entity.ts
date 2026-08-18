import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('indicators')
export class Indicator {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  type: string;

  @Column({ type: 'float' })
  value: number;

  @Column({ type: 'float', nullable: true })
  baselineValue: number | null;

  @Column({ default: '' })
  baselineReference: string;

  @CreateDateColumn()
  calculatedAt: Date;
}
