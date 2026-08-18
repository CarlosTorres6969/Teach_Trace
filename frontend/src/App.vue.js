import { useRouter } from 'vue-router';
import { api } from './api';
import { auth, clearSession } from './auth';
const router = useRouter();
async function logout() {
    try {
        await api('/auth/logout', { method: 'POST' });
    }
    catch {
        // El token también se elimina localmente si la API ya no está disponible.
    }
    finally {
        clearSession();
        await router.push('/login');
    }
}
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
if (__VLS_ctx.auth.user) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
        ...{ class: "topbar" },
    });
    /** @type {__VLS_StyleScopedClasses['topbar']} */ ;
    let __VLS_0;
    /** @ts-ignore @type { | typeof __VLS_components.RouterLink | typeof __VLS_components.RouterLink} */
    RouterLink;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        to: (__VLS_ctx.auth.user.role === 'student' ? '/student' : '/teacher'),
        ...{ class: "brand" },
    }));
    const __VLS_2 = __VLS_1({
        to: (__VLS_ctx.auth.user.role === 'student' ? '/student' : '/teacher'),
        ...{ class: "brand" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    /** @type {__VLS_StyleScopedClasses['brand']} */ ;
    const { default: __VLS_5 } = __VLS_3.slots;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "brand-mark" },
    });
    /** @type {__VLS_StyleScopedClasses['brand-mark']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
    // @ts-ignore
    [auth, auth,];
    var __VLS_3;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "user-menu" },
    });
    /** @type {__VLS_StyleScopedClasses['user-menu']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
    (__VLS_ctx.auth.user.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.auth.user.role === 'student' ? 'Estudiante' : 'Docente');
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.logout) },
        ...{ class: "button ghost" },
        type: "button",
    });
    /** @type {__VLS_StyleScopedClasses['button']} */ ;
    /** @type {__VLS_StyleScopedClasses['ghost']} */ ;
}
let __VLS_6;
/** @ts-ignore @type { | typeof __VLS_components.RouterView} */
RouterView;
// @ts-ignore
const __VLS_7 = __VLS_asFunctionalComponent1(__VLS_6, new __VLS_6({}));
const __VLS_8 = __VLS_7({}, ...__VLS_functionalComponentArgsRest(__VLS_7));
// @ts-ignore
[auth, auth, logout,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
