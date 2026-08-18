import { onMounted, ref } from 'vue';
import { api } from '../api';
import { auth } from '../auth';
const activities = ref([]);
const error = ref('');
const loading = ref(true);
const statusText = {
    not_submitted: 'Sin entregar',
    submitted: 'Entregado',
    under_review: 'En revisión',
    evaluated: 'Evaluado',
};
onMounted(async () => {
    try {
        activities.value = await api('/student/activities');
    }
    catch (cause) {
        error.value = cause instanceof Error ? cause.message : 'No se pudieron cargar las actividades';
    }
    finally {
        loading.value = false;
    }
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.main, __VLS_intrinsics.main)({
    ...{ class: "page" },
});
/** @type {__VLS_StyleScopedClasses['page']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "page-heading" },
});
/** @type {__VLS_StyleScopedClasses['page-heading']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "eyebrow" },
});
/** @type {__VLS_StyleScopedClasses['eyebrow']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h1, __VLS_intrinsics.h1)({});
(__VLS_ctx.auth.user?.name);
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
if (__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
}
else if (__VLS_ctx.error) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "alert error" },
    });
    /** @type {__VLS_StyleScopedClasses['alert']} */ ;
    /** @type {__VLS_StyleScopedClasses['error']} */ ;
    (__VLS_ctx.error);
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "card-grid" },
    });
    /** @type {__VLS_StyleScopedClasses['card-grid']} */ ;
    for (const [activity] of __VLS_vFor((__VLS_ctx.activities))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
            key: (activity.id),
            ...{ class: "activity-card" },
        });
        /** @type {__VLS_StyleScopedClasses['activity-card']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "card-topline" },
        });
        /** @type {__VLS_StyleScopedClasses['card-topline']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (activity.subject);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "status" },
            'data-status': (activity.submissionStatus),
        });
        /** @type {__VLS_StyleScopedClasses['status']} */ ;
        (__VLS_ctx.statusText[activity.submissionStatus ?? 'not_submitted']);
        __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
        (activity.title);
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
        let __VLS_0;
        /** @ts-ignore @type { | typeof __VLS_components.RouterLink | typeof __VLS_components.RouterLink} */
        RouterLink;
        // @ts-ignore
        const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
            ...{ class: "button primary" },
            to: (`/student/activities/${activity.id}`),
        }));
        const __VLS_2 = __VLS_1({
            ...{ class: "button primary" },
            to: (`/student/activities/${activity.id}`),
        }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        /** @type {__VLS_StyleScopedClasses['button']} */ ;
        /** @type {__VLS_StyleScopedClasses['primary']} */ ;
        const { default: __VLS_5 } = __VLS_3.slots;
        // @ts-ignore
        [auth, loading, error, error, activities, statusText,];
        var __VLS_3;
        // @ts-ignore
        [];
    }
    if (!__VLS_ctx.activities.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "empty-state" },
        });
        /** @type {__VLS_StyleScopedClasses['empty-state']} */ ;
    }
}
// @ts-ignore
[activities,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
