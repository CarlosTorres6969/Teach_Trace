import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../api';
const route = useRoute();
const activityId = Number(route.params.id);
const tab = ref('logbook');
const title = ref('Actividad');
const loading = ref(true);
const message = ref('');
const error = ref('');
const logbook = reactive({ initialIdeas: '', prompts: '', validationsAndDecisions: '', finalReflection: '' });
const declaration = reactive({ toolName: '', usageLevel: 1, purpose: '', promptSummary: '' });
const submission = reactive({ status: 'not_submitted', submittedAt: '', productText: '', productUrl: '' });
const statusText = computed(() => ({
    not_submitted: 'Sin entregar', submitted: 'Entregado', under_review: 'En revisión', evaluated: 'Evaluado',
}[submission.status] ?? submission.status));
async function load() {
    try {
        const [logbookData, declarationData, submissionData] = await Promise.all([
            api(`/student/activities/${activityId}/logbook`),
            api(`/student/activities/${activityId}/ai-declaration`),
            api(`/student/activities/${activityId}/submission-status`),
        ]);
        title.value = logbookData.activity.title;
        Object.assign(logbook, logbookData);
        Object.assign(declaration, declarationData);
        Object.assign(submission, submissionData);
    }
    catch (cause) {
        error.value = cause instanceof Error ? cause.message : 'No se pudo cargar la actividad';
    }
    finally {
        loading.value = false;
    }
}
async function saveLogbook() {
    await runSave('Bitácora actualizada', `/student/activities/${activityId}/logbook`, logbook);
}
async function saveDeclaration() {
    await runSave('Declaración de IA guardada', `/student/activities/${activityId}/ai-declaration`, declaration);
}
async function submitProduct() {
    if (!submission.productText.trim() && !submission.productUrl.trim()) {
        error.value = 'Escribe el producto o agrega un enlace antes de entregar.';
        return;
    }
    const result = await runSave('Producto entregado correctamente', `/student/activities/${activityId}/submission`, { productText: submission.productText, productUrl: submission.productUrl });
    if (result)
        Object.assign(submission, result);
}
async function runSave(success, path, data) {
    message.value = '';
    error.value = '';
    try {
        const result = await api(path, { method: 'PUT', body: JSON.stringify(data) });
        message.value = success;
        return result;
    }
    catch (cause) {
        error.value = cause instanceof Error ? cause.message : 'No fue posible guardar';
        return null;
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
    to: "/student",
    ...{ class: "back-link" },
}));
const __VLS_2 = __VLS_1({
    to: "/student",
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
(__VLS_ctx.title);
if (__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.nav, __VLS_intrinsics.nav)({
        ...{ class: "tabs" },
        'aria-label': "Secciones de la actividad",
    });
    /** @type {__VLS_StyleScopedClasses['tabs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.loading))
                    throw 0;
                return (__VLS_ctx.tab = 'logbook');
                // @ts-ignore
                [title, loading, tab,];
            } },
        ...{ class: ({ active: __VLS_ctx.tab === 'logbook' }) },
    });
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.loading))
                    throw 0;
                return (__VLS_ctx.tab = 'ai');
                // @ts-ignore
                [tab, tab,];
            } },
        ...{ class: ({ active: __VLS_ctx.tab === 'ai' }) },
    });
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.loading))
                    throw 0;
                return (__VLS_ctx.tab = 'submission');
                // @ts-ignore
                [tab, tab,];
            } },
        ...{ class: ({ active: __VLS_ctx.tab === 'submission' }) },
    });
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    if (__VLS_ctx.message) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "alert success" },
        });
        /** @type {__VLS_StyleScopedClasses['alert']} */ ;
        /** @type {__VLS_StyleScopedClasses['success']} */ ;
        (__VLS_ctx.message);
    }
    if (__VLS_ctx.error) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "alert error" },
        });
        /** @type {__VLS_StyleScopedClasses['alert']} */ ;
        /** @type {__VLS_StyleScopedClasses['error']} */ ;
        (__VLS_ctx.error);
    }
    if (__VLS_ctx.tab === 'logbook') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.form, __VLS_intrinsics.form)({
            ...{ onSubmit: (__VLS_ctx.saveLogbook) },
            ...{ class: "panel form-stack" },
        });
        /** @type {__VLS_StyleScopedClasses['panel']} */ ;
        /** @type {__VLS_StyleScopedClasses['form-stack']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
            value: (__VLS_ctx.logbook.initialIdeas),
            rows: "4",
            maxlength: "10000",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
            value: (__VLS_ctx.logbook.prompts),
            rows: "5",
            maxlength: "20000",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
            value: (__VLS_ctx.logbook.validationsAndDecisions),
            rows: "5",
            maxlength: "20000",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
            value: (__VLS_ctx.logbook.finalReflection),
            rows: "5",
            maxlength: "10000",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ class: "button primary" },
        });
        /** @type {__VLS_StyleScopedClasses['button']} */ ;
        /** @type {__VLS_StyleScopedClasses['primary']} */ ;
    }
    else if (__VLS_ctx.tab === 'ai') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.form, __VLS_intrinsics.form)({
            ...{ onSubmit: (__VLS_ctx.saveDeclaration) },
            ...{ class: "panel form-stack" },
        });
        /** @type {__VLS_StyleScopedClasses['panel']} */ ;
        /** @type {__VLS_StyleScopedClasses['form-stack']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            maxlength: "120",
            required: true,
        });
        (__VLS_ctx.declaration.toolName);
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.declaration.usageLevel),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: (1),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: (2),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: (3),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
            value: (__VLS_ctx.declaration.purpose),
            rows: "4",
            maxlength: "5000",
            required: true,
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
            value: (__VLS_ctx.declaration.promptSummary),
            rows: "5",
            maxlength: "10000",
            required: true,
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ class: "button primary" },
        });
        /** @type {__VLS_StyleScopedClasses['button']} */ ;
        /** @type {__VLS_StyleScopedClasses['primary']} */ ;
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.form, __VLS_intrinsics.form)({
            ...{ onSubmit: (__VLS_ctx.submitProduct) },
            ...{ class: "panel form-stack" },
        });
        /** @type {__VLS_StyleScopedClasses['panel']} */ ;
        /** @type {__VLS_StyleScopedClasses['form-stack']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "card-topline" },
        });
        /** @type {__VLS_StyleScopedClasses['card-topline']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "status" },
            'data-status': (__VLS_ctx.submission.status),
        });
        /** @type {__VLS_StyleScopedClasses['status']} */ ;
        (__VLS_ctx.statusText);
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
            value: (__VLS_ctx.submission.productText),
            rows: "10",
            maxlength: "50000",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "url",
            placeholder: "https://…",
            maxlength: "500",
        });
        (__VLS_ctx.submission.productUrl);
        if (__VLS_ctx.submission.submittedAt) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "muted" },
            });
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            (new Date(__VLS_ctx.submission.submittedAt).toLocaleString());
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ class: "button primary" },
        });
        /** @type {__VLS_StyleScopedClasses['button']} */ ;
        /** @type {__VLS_StyleScopedClasses['primary']} */ ;
        (__VLS_ctx.submission.status === 'not_submitted' ? 'Entregar producto' : 'Actualizar entrega');
    }
}
// @ts-ignore
[tab, tab, tab, message, message, error, error, saveLogbook, logbook, logbook, logbook, logbook, saveDeclaration, declaration, declaration, declaration, declaration, submitProduct, submission, submission, submission, submission, submission, submission, statusText,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
