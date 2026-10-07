import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { AuthSession } from './auth-session.entity';

export enum UserRole {
  ADMIN = 'admin',
  STUDENT = 'student',
  TEACHER = 'teacher',
}

export function availableUserRoles(user: Pick<User, 'role'>): UserRole[] {
  return user.role === UserRole.ADMIN
    ? [UserRole.ADMIN, UserRole.TEACHER]
    : [user.role];
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

  /** Rol seleccionado para la petición actual; proviene del JWT y nunca se persiste. */
  activeRole?: UserRole;

  @Column({ default: true })
  active: boolean;

  @Column({ default: false })
  mustChangePassword: boolean;

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
