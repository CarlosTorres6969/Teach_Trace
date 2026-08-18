import { reactive } from 'vue';
const savedUser = localStorage.getItem('teachtrace_user');
export const auth = reactive({
    token: localStorage.getItem('teachtrace_token') ?? '',
    user: savedUser ? JSON.parse(savedUser) : null,
});
export function setSession(token, user) {
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
