import { createRouter, createWebHistory } from 'vue-router';
import { auth, restoreSession, clearSession } from './auth';
import AccessibilitySettingsView from './views/AccessibilitySettingsView.vue';
import LoginView from './views/LoginView.vue';
import ForgotPasswordView from './views/ForgotPasswordView.vue';
import ResetPasswordView from './views/ResetPasswordView.vue';
import ChangeTemporaryPasswordView from './views/ChangeTemporaryPasswordView.vue';
import NotificationSettingsView from './views/NotificationSettingsView.vue';
import StudentDashboard from './views/StudentDashboard.vue';
import StudentActivityView from './views/StudentActivityView.vue';
import StudentProfileView from './views/StudentProfileView.vue';
import StudentResultsView from './views/StudentResultsView.vue';
import TeacherDashboard from './views/TeacherDashboard.vue';
import TeacherEvaluationDashboard from './views/TeacherEvaluationDashboard.vue';
import TeacherSubmissionsView from './views/TeacherSubmissionsView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/login' },
    { path: '/login', component: LoginView, meta: { public: true } },
    { path: '/forgot-password', component: ForgotPasswordView, meta: { public: true } },
    { path: '/reset-password', component: ResetPasswordView, meta: { public: true } },
    { path: '/change-password', component: ChangeTemporaryPasswordView },
    { path: '/student', component: StudentDashboard, meta: { role: 'student' } },
    { path: '/student/profile', component: StudentProfileView, meta: { role: 'student' } },
    { path: '/student/activities/:id', component: StudentActivityView, meta: { role: 'student' } },
    { path: '/student/activities/:id/results', component: StudentResultsView, meta: { role: 'student' } },
    { path: '/settings/notifications', component: NotificationSettingsView, meta: { role: 'student' } },
    { path: '/settings/accessibility', component: AccessibilitySettingsView, meta: { role: 'student' } },
    { path: '/teacher', component: TeacherDashboard, meta: { role: 'teacher' } },
    { path: '/teacher/evaluations', component: TeacherEvaluationDashboard, meta: { role: 'teacher' } },
    { path: '/teacher/activities/:id/submissions', component: TeacherSubmissionsView, meta: { role: 'teacher' } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

let isRedirecting = false;

router.beforeEach(async (to) => {
  if (isRedirecting) return true;
  
  await restoreSession();

  if (auth.user?.mustChangePassword && to.path !== '/change-password') {
    return '/change-password';
  }
  if (auth.user && !auth.user.mustChangePassword && to.path === '/change-password') {
    return auth.user.role === 'student' ? '/student' : '/teacher';
  }
  
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

export function handleUnauthorized(): void {
  if (!isRedirecting) {
    isRedirecting = true;
    clearSession(false);
    router.push('/login');
  }
}
