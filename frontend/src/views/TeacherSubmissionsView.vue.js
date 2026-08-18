import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../api';
const route = useRoute();
const activityId = Number(route.params.id);
const submissions = ref([]);
const selected = ref(null);
const error = ref('');
async function load() {
    try {
        submissions.value = await api(`/teacher/activities/${activityId}/submissions`);
    }
    catch (cause) {
        error.value = cause instanceof Error ? cause.message : 'No se pudieron cargar las entregas';
    }
}
async function openSubmission(id) {
    try {
        selected.value = await api(`/teacher/submissions/${id}`);
    }
    catch (cause) {
        error.value = cause instanceof Error ? cause.message : 'No se pudo abrir la entrega';
    }
}
onMounted(load);
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.main, __VLS_intrinsics.main)({
    ...{ class: "page narrow" },
});
/** @type {__VLS_StyleScopedClasses['page']} */ ;
/** @type {__VLS_StyleScopedClasses['narrow']} */ ;
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.RouterLink | typeof __VLS_components.RouterLink} */
RouterLink;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    to: "/teacher",
    ...{ class: "back-link" },
}));
const __VLS_2 = __VLS_1({
    to: "/teacher",
    ...{ class: "back-link" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['back-link']} */ ;
const { default: __VLS_5 } = __VLS_3.slots;
var __VLS_3;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "page-heading compact" },
});
/** @type {__VLS_StyleScopedClasses['page-heading']} */ ;
/** @type {__VLS_StyleScopedClasses['compact']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "eyebrow" },
});
/** @type {__VLS_StyleScopedClasses['eyebrow']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h1, __VLS_intrinsics.h1)({});
if (__VLS_ctx.error) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "alert error" },
    });
    /** @type {__VLS_StyleScopedClasses['alert']} */ ;
    /** @type {__VLS_StyleScopedClasses['error']} */ ;
    (__VLS_ctx.error);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "split-view" },
});
/** @type {__VLS_StyleScopedClasses['split-view']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "submission-list panel" },
});
/** @type {__VLS_StyleScopedClasses['submission-list']} */ ;
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
for (const [item] of __VLS_vFor((__VLS_ctx.submissions))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                return (__VLS_ctx.openSubmission(item.id));
                // @ts-ignore
                [error, error, submissions, openSubmission,];
            } },
        key: (item.id),
        ...{ class: ({ selected: __VLS_ctx.selected?.id === item.id }) },
    });
    /** @type {__VLS_StyleScopedClasses['selected']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
    (item.student.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (item.student.email);
    __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
    (new Date(item.submittedAt).toLocaleString());
    // @ts-ignore
    [selected,];
}
if (!__VLS_ctx.submissions.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "empty-state" },
    });
    /** @type {__VLS_StyleScopedClasses['empty-state']} */ ;
}
if (__VLS_ctx.selected) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
        ...{ class: "panel evidence" },
    });
    /** @type {__VLS_StyleScopedClasses['panel']} */ ;
    /** @type {__VLS_StyleScopedClasses['evidence']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "eyebrow" },
    });
    /** @type {__VLS_StyleScopedClasses['eyebrow']} */ ;
    (__VLS_ctx.selected.activity.title);
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
    (__VLS_ctx.selected.student.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "evidence-text" },
    });
    /** @type {__VLS_StyleScopedClasses['evidence-text']} */ ;
    (__VLS_ctx.selected.productText || 'Sin contenido de texto.');
    if (__VLS_ctx.selected.productUrl) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
            href: (__VLS_ctx.selected.productUrl),
            target: "_blank",
            rel: "noopener",
        });
    }
    if (__VLS_ctx.selected.logbook) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.dl, __VLS_intrinsics.dl)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({});
        (__VLS_ctx.selected.logbook.initialIdeas);
        __VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({});
        (__VLS_ctx.selected.logbook.prompts);
        __VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({});
        (__VLS_ctx.selected.logbook.validationsAndDecisions);
        __VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({});
        (__VLS_ctx.selected.logbook.finalReflection);
    }
    if (__VLS_ctx.selected.aiDeclaration) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.dl, __VLS_intrinsics.dl)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({});
        (__VLS_ctx.selected.aiDeclaration.toolName);
        __VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({});
        (__VLS_ctx.selected.aiDeclaration.usageLevel);
        __VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({});
        (__VLS_ctx.selected.aiDeclaration.purpose);
        __VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({});
        (__VLS_ctx.selected.aiDeclaration.promptSummary);
    }
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "empty-state panel" },
    });
    /** @type {__VLS_StyleScopedClasses['empty-state']} */ ;
    /** @type {__VLS_StyleScopedClasses['panel']} */ ;
}
// @ts-ignore
[submissions, selected, selected, selected, selected, selected, selected, selected, selected, selected, selected, selected, selected, selected, selected, selected, selected,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
