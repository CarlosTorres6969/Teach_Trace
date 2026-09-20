import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';
import { dateColumnType } from '../database/database-column-types';

@Entity('auth_sessions')
export class AuthSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.sessions, { eager: true, onDelete: 'CASCADE' })
  user: User;

  @Column({ type: dateColumnType })
  expiresAt: Date;

  @Column({ type: dateColumnType, nullable: true })
  revokedAt: Date | null;
}
