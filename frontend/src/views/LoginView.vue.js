import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api';
import { setSession } from '../auth';
const router = useRouter();
const form = reactive({ email: '', password: '' });
const error = ref('');
const loading = ref(false);
async function login() {
    error.value = '';
    loading.value = true;
    try {
        const result = await api('/auth/login', {
            method: 'POST',
            body: JSON.stringify(form),
        });
        setSession(result.accessToken, result.user);
        await router.push(result.user.role === 'student' ? '/student' : '/teacher');
    }
    catch (cause) {
        error.value = cause instanceof Error ? cause.message : 'No fue posible iniciar sesión';
    }
    finally {
        loading.value = false;
    }
}
function useDemo(role) {
    form.email = role === 'student' ? 'estudiante@unah.edu.hn' : 'docente@unah.edu.hn';
    form.password = role === 'student' ? 'Estudiante123!' : 'Docente123!';
}
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.main, __VLS_intrinsics.main)({
    ...{ class: "login-shell" },
});
/** @type {__VLS_StyleScopedClasses['login-shell']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "login-intro" },
});
/** @type {__VLS_StyleScopedClasses['login-intro']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "eyebrow" },
});
/** @type {__VLS_StyleScopedClasses['eyebrow']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h1, __VLS_intrinsics.h1)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "principle" },
});
/** @type {__VLS_StyleScopedClasses['principle']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "login-card" },
});
/** @type {__VLS_StyleScopedClasses['login-card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "logo-row" },
});
/** @type {__VLS_StyleScopedClasses['logo-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "brand-mark" },
});
/** @type {__VLS_StyleScopedClasses['brand-mark']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "muted" },
});
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.form, __VLS_intrinsics.form)({
    ...{ onSubmit: (__VLS_ctx.login) },
});
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "email",
    required: true,
});
(__VLS_ctx.form.email);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "password",
    minlength: "8",
    required: true,
});
(__VLS_ctx.form.password);
if (__VLS_ctx.error) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "alert error" },
    });
    /** @type {__VLS_StyleScopedClasses['alert']} */ ;
    /** @type {__VLS_StyleScopedClasses['error']} */ ;
    (__VLS_ctx.error);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ class: "button primary full" },
    disabled: (__VLS_ctx.loading),
});
/** @type {__VLS_StyleScopedClasses['button']} */ ;
/** @type {__VLS_StyleScopedClasses['primary']} */ ;
/** @type {__VLS_StyleScopedClasses['full']} */ ;
(__VLS_ctx.loading ? 'Ingresando…' : 'Ingresar');
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "demo-box" },
});
/** @type {__VLS_StyleScopedClasses['demo-box']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            return (__VLS_ctx.useDemo('student'));
            // @ts-ignore
            [login, form, form, error, error, loading, loading, useDemo,];
        } },
    ...{ class: "text-button" },
    type: "button",
});
/** @type {__VLS_StyleScopedClasses['text-button']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            return (__VLS_ctx.useDemo('teacher'));
            // @ts-ignore
            [useDemo,];
        } },
    ...{ class: "text-button" },
    type: "button",
});
/** @type {__VLS_StyleScopedClasses['text-button']} */ ;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
