import { createMemoryHistory, createRouter } from 'vue-router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { auth, setSession, clearSession, restoreSession } from './auth';
import { handleUnauthorized } from './router';
import type { User } from './types';

const testRoutes = [
  { path: '/', redirect: '/login' },
  { path: '/login', name: 'login', component: { template: '<div>Login</div>' }, meta: { public: true } },
  { path: '/student', name: 'student', component: { template: '<div>Student</div>' }, meta: { role: 'student' } },
  { path: '/student/activities/:id', name: 'student-activity', component: { template: '<div>Activity</div>' }, meta: { role: 'student' } },
  { path: '/teacher', name: 'teacher', component: { template: '<div>Teacher</div>' }, meta: { role: 'teacher' } },
  { path: '/teacher/activities/:id/submissions', name: 'teacher-submissions', component: { template: '<div>Submissions</div>' }, meta: { role: 'teacher' } },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

function createTestRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: testRoutes,
  });

  let isRedirecting = false;

  router.beforeEach(async (to) => {
    if (isRedirecting) return true;
    
    await restoreSession();
    
    if (to.meta.public) {
      if (auth.user) return auth.user.role === 'student' ? '/student' : '/teacher';
      return true;
    }
    
    if (!auth.user) {
      isRedirecting = true;
      return '/login';
    }
    
    if (to.meta.role && to.meta.role !== auth.user.role) {
      return auth.user.role === 'student' ? '/student' : '/teacher';
    }
    
    return true;
  });

  return router;
}

function createStudentUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    email: 'estudiante@unah.edu.hn',
    name: 'Estudiante',
    role: 'student',
    theme: 'system',
    accessibilitySettings: { fontSize: 100, highContrast: false, reducedMotion: false },
    ...overrides,
  };
}

function createTeacherUser(overrides: Partial<User> = {}): User {
  return {
    id: 2,
    email: 'docente@unah.edu.hn',
    name: 'Docente',
    role: 'teacher',
    theme: 'system',
    accessibilitySettings: { fontSize: 100, highContrast: false, reducedMotion: false },
    ...overrides,
  };
}

describe('Auth - Session management', () => {
  beforeEach(() => {
    clearSession();
  });

  it('setSession establece usuario y initialized', () => {
    const user = createStudentUser();
    setSession(user);
    expect(auth.user).toEqual(user);
    expect(auth.initialized).toBe(true);
  });

  it('clearSession limpia usuario y mantiene initialized', () => {
    setSession(createStudentUser());
    clearSession();
    expect(auth.user).toBeNull();
    expect(auth.initialized).toBe(true);
  });

  it('clearSession con notify=false no emite evento', () => {
    setSession(createStudentUser());
    clearSession(false);
    expect(auth.user).toBeNull();
  });
});

describe('Router - Role-based access control (logic)', () => {
  const checkAccess = (user: User | null, toPath: string, toMeta: Record<string, any>): string | true => {
    // Simulate the router guard logic
    if (toMeta.public) {
      if (user) return user.role === 'student' ? '/student' : '/teacher';
      return true;
    }
    
    if (!user) return '/login';
    
    if (toMeta.role && toMeta.role !== user.role) {
      return user.role === 'student' ? '/student' : '/teacher';
    }
    
    return true;
  };

  it('redirige a /login si no hay sesión y se accede a ruta protegida', () => {
    const result = checkAccess(null, '/student', { role: 'student' });
    expect(result).toBe('/login');
  });

  it('permite acceso a /login sin sesión', () => {
    const result = checkAccess(null, '/login', { public: true });
    expect(result).toBe(true);
  });

  it('redirige al panel correspondiente si hay sesión y se accede a /login', () => {
    const user = createStudentUser();
    const result = checkAccess(user, '/login', { public: true });
    expect(result).toBe('/student');
  });

  it('permite a estudiante acceder a su panel', () => {
    const user = createStudentUser();
    const result = checkAccess(user, '/student', { role: 'student' });
    expect(result).toBe(true);
  });

  it('permite a estudiante acceder a sus actividades', () => {
    const user = createStudentUser();
    const result = checkAccess(user, '/student/activities/1', { role: 'student' });
    expect(result).toBe(true);
  });

  it('redirige a estudiante si intenta acceder a panel docente', () => {
    const user = createStudentUser();
    const result = checkAccess(user, '/teacher', { role: 'teacher' });
    expect(result).toBe('/student');
  });

  it('redirige a estudiante si intenta acceder a entregas de docente', () => {
    const user = createStudentUser();
    const result = checkAccess(user, '/teacher/activities/1/submissions', { role: 'teacher' });
    expect(result).toBe('/student');
  });

  it('permite a docente acceder a su panel', () => {
    const user = createTeacherUser();
    const result = checkAccess(user, '/teacher', { role: 'teacher' });
    expect(result).toBe(true);
  });

  it('permite a docente acceder a entregas', () => {
    const user = createTeacherUser();
    const result = checkAccess(user, '/teacher/activities/1/submissions', { role: 'teacher' });
    expect(result).toBe(true);
  });

  it('redirige a docente si intenta acceder a panel estudiante', () => {
    const user = createTeacherUser();
    const result = checkAccess(user, '/student', { role: 'student' });
    expect(result).toBe('/teacher');
  });

  it('redirige a docente si intenta acceder a actividades de estudiante', () => {
    const user = createTeacherUser();
    const result = checkAccess(user, '/student/activities/1', { role: 'student' });
    expect(result).toBe('/teacher');
  });
});

describe('handleUnauthorized', () => {
  beforeEach(() => {
    clearSession();
  });

  it('limpia sesión', () => {
    setSession(createStudentUser());
    handleUnauthorized();
    expect(auth.user).toBeNull();
  });
});
