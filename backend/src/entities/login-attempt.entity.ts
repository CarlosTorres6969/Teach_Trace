import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('login_attempts')
@Index(['ip', 'email'], { unique: false })
export class LoginAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 45 })
  ip: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'int', default: 0 })
  count: number;

  @Column({ type: 'datetime', nullable: true })
  lockedUntil: Date | null;

  @Column()
  createdAt: Date;

  @Column()
  updatedAt: Date;
}
