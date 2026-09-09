import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { AuthSession } from './auth-session.entity';

export enum UserRole {
  STUDENT = 'student',
  TEACHER = 'teacher',
}

export enum UserTheme {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system',
}

export type AccessibilitySettings = {
  fontSize: number;
  highContrast: boolean;
  reducedMotion: boolean;
};

export const DEFAULT_ACCESSIBILITY_SETTINGS: AccessibilitySettings = {
  fontSize: 100,
  highContrast: false,
  reducedMotion: false,
};

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

  @Column({ type: 'simple-enum', enum: UserTheme, default: UserTheme.SYSTEM })
  theme: UserTheme;

  @Column({
    type: 'simple-json',
    default: '{"fontSize":100,"highContrast":false,"reducedMotion":false}',
  })
  accessibilitySettings: AccessibilitySettings;

  @OneToMany(() => AuthSession, (session) => session.user)
  sessions: AuthSession[];
}
