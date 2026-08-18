import { createRouter, createWebHistory } from 'vue-router';
import { auth } from './auth';
import LoginView from './views/LoginView.vue';
import StudentDashboard from './views/StudentDashboard.vue';
import StudentActivityView from './views/StudentActivityView.vue';
import TeacherDashboard from './views/TeacherDashboard.vue';
import TeacherSubmissionsView from './views/TeacherSubmissionsView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/login' },
    { path: '/login', component: LoginView, meta: { public: true } },
    { path: '/student', component: StudentDashboard, meta: { role: 'student' } },
    { path: '/student/activities/:id', component: StudentActivityView, meta: { role: 'student' } },
    { path: '/teacher', component: TeacherDashboard, meta: { role: 'teacher' } },
    {
      path: '/teacher/activities/:id/submissions',
      component: TeacherSubmissionsView,
      meta: { role: 'teacher' },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.beforeEach((to) => {
  if (to.meta.public) {
    if (auth.user) return auth.user.role === 'student' ? '/student' : '/teacher';
    return true;
  }
  if (!auth.token || !auth.user) return '/login';
  if (to.meta.role && to.meta.role !== auth.user.role) {
    return auth.user.role === 'student' ? '/student' : '/teacher';
  }
  return true;
});
