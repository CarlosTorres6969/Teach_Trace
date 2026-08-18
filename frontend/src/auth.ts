import { reactive } from 'vue';
import type { User } from './types';

const savedUser = localStorage.getItem('teachtrace_user');

export const auth = reactive<{ token: string; user: User | null }>({
  token: localStorage.getItem('teachtrace_token') ?? '',
  user: savedUser ? (JSON.parse(savedUser) as User) : null,
});

export function setSession(token: string, user: User) {
  auth.token = token;
  auth.user = user;
  localStorage.setItem('teachtrace_token', token);
  localStorage.setItem('teachtrace_user', JSON.stringify(user));
}

export function clearSession() {
  auth.token = '';
  auth.user = null;
  localStorage.removeItem('teachtrace_token');
  localStorage.removeItem('teachtrace_user');
}
