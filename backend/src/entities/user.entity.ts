import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { AuthSession } from './auth-session.entity';

export enum UserRole {
  STUDENT = 'student',
  TEACHER = 'teacher',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  name: string;

  @Column()
  passwordHash: string;

  @Column({ type: 'simple-enum', enum: UserRole })
  role: UserRole;

  @Column({ default: true })
  active: boolean;

  @OneToMany(() => AuthSession, (session) => session.user)
  sessions: AuthSession[];
}
