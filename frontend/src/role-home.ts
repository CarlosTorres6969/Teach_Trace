import type { Role } from './types';

export function homeForRole(role: Role): string {
  if (role === 'admin') return '/admin';
  return role === 'student' ? '/student' : '/teacher';
}
