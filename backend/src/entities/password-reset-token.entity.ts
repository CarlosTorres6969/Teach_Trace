import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';
import { dateColumnType } from '../database/database-column-types';

@Entity('password_reset_tokens')
export class PasswordResetToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  user: User;

  @Column({ unique: true })
  tokenHash: string;

  @Column({ type: dateColumnType })
  expiresAt: Date;

  @Column({ type: dateColumnType, nullable: true })
  usedAt: Date | null;

  @Column({ type: dateColumnType })
  createdAt: Date;

  @Column({ type: 'varchar', nullable: true })
  requestIp: string | null;
}
