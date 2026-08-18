import { onMounted, reactive, ref } from 'vue';
import { api } from '../api';
import { auth } from '../auth';
const activities = ref([]);
const rubrics = ref([]);
const error = ref('');
const message = ref('');
const section = ref('activities');
const activityForm = reactive({ title: '', subject: '', dueDate: '', activityType: '' });
const outcomes = reactive({});
const selectedRubrics = reactive({});
const rubricName = ref('');
const criteria = ref([emptyCriterion()]);
function emptyCriterion() {
    return { name: '', dimension: '', descriptors: { level1: '', level2: '', level3: '', level4: '' } };
}
async function load() {
    try {
        [activities.value, rubrics.value] = await Promise.all([
            api('/teacher/activities'), api('/teacher/rubrics'),
        ]);
        activities.value.forEach((activity) => {
            outcomes[activity.id] = (activity.learningOutcomes ?? []).join('\n');
            selectedRubrics[activity.id] = activity.rubric?.id;
        });
    }
    catch (cause) {
        showError(cause);
    }
}
async function createActivity() {
    await act('Actividad creada', async () => {
        await api('/teacher/activities', { method: 'POST', body: JSON.stringify(activityForm) });
        Object.assign(activityForm, { title: '', subject: '', dueDate: '', activityType: '' });
        await load();
    });
}
async function saveOutcomes(activityId) {
    const learningOutcomes = outcomes[activityId].split('\n').map((item) => item.trim()).filter(Boolean);
    await act('Resultados de aprendizaje actualizados', () => api(`/teacher/activities/${activityId}/learning-outcomes`, {
        method: 'PUT', body: JSON.stringify({ learningOutcomes }),
    }));
}
async function associateRubric(activityId) {
    const rubricId = selectedRubrics[activityId];
    if (!rubricId)
        return;
    await act('Rúbrica asociada a la actividad', async () => {
        await api(`/teacher/activities/${activityId}/rubric`, { method: 'PUT', body: JSON.stringify({ rubricId }) });
        await load();
    });
}
async function createRubric() {
    await act('Rúbrica creada', async () => {
        await api('/teacher/rubrics', {
            method: 'POST', body: JSON.stringify({ name: rubricName.value, criteria: criteria.value }),
        });
        rubricName.value = '';
        criteria.value = [emptyCriterion()];
        await load();
    });
}
async function act(success, action) {
    error.value = '';
    message.value = '';
    try {
        await action();
        message.value = success;
    }
    catch (cause) {
        showError(cause);
    }
}
function showError(cause) {
    error.value = cause instanceof Error ? cause.message : 'No fue posible completar la operación';
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
__VLS_asFunctionalElement1(__VLS_intrinsics.nav, __VLS_intrinsics.nav)({
    ...{ class: "tabs teacher-tabs" },
});
/** @type {__VLS_StyleScopedClasses['tabs']} */ ;
/** @type {__VLS_StyleScopedClasses['teacher-tabs']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            return (__VLS_ctx.section = 'activities');
            // @ts-ignore
            [auth, section,];
        } },
    ...{ class: ({ active: __VLS_ctx.section === 'activities' }) },
});
/** @type {__VLS_StyleScopedClasses['active']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            return (__VLS_ctx.section = 'rubrics');
            // @ts-ignore
            [section, section,];
        } },
    ...{ class: ({ active: __VLS_ctx.section === 'rubrics' }) },
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
if (__VLS_ctx.section === 'activities') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.form, __VLS_intrinsics.form)({
        ...{ onSubmit: (__VLS_ctx.createActivity) },
        ...{ class: "panel form-grid" },
    });
    /** @type {__VLS_StyleScopedClasses['panel']} */ ;
    /** @type {__VLS_StyleScopedClasses['form-grid']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "span-2" },
    });
    /** @type {__VLS_StyleScopedClasses['span-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        required: true,
        maxlength: "160",
    });
    (__VLS_ctx.activityForm.title);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        required: true,
        maxlength: "120",
    });
    (__VLS_ctx.activityForm.subject);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "date",
        required: true,
    });
    (__VLS_ctx.activityForm.dueDate);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        placeholder: "Ensayo, proyecto…",
        required: true,
        maxlength: "80",
    });
    (__VLS_ctx.activityForm.activityType);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ class: "button primary span-2" },
    });
    /** @type {__VLS_StyleScopedClasses['button']} */ ;
    /** @type {__VLS_StyleScopedClasses['primary']} */ ;
    /** @type {__VLS_StyleScopedClasses['span-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "section-block" },
    });
    /** @type {__VLS_StyleScopedClasses['section-block']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "section-title" },
    });
    /** @type {__VLS_StyleScopedClasses['section-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.activities.length);
    for (const [activity] of __VLS_vFor((__VLS_ctx.activities))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
            key: (activity.id),
            ...{ class: "panel activity-editor" },
        });
        /** @type {__VLS_StyleScopedClasses['panel']} */ ;
        /** @type {__VLS_StyleScopedClasses['activity-editor']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "card-topline" },
        });
        /** @type {__VLS_StyleScopedClasses['card-topline']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "eyebrow" },
        });
        /** @type {__VLS_StyleScopedClasses['eyebrow']} */ ;
        (activity.subject);
        (activity.activityType);
        __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
        (activity.title);
        let __VLS_0;
        /** @ts-ignore @type { | typeof __VLS_components.RouterLink | typeof __VLS_components.RouterLink} */
        RouterLink;
        // @ts-ignore
        const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
            ...{ class: "button secondary" },
            to: (`/teacher/activities/${activity.id}/submissions`),
        }));
        const __VLS_2 = __VLS_1({
            ...{ class: "button secondary" },
            to: (`/teacher/activities/${activity.id}/submissions`),
        }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        /** @type {__VLS_StyleScopedClasses['button']} */ ;
        /** @type {__VLS_StyleScopedClasses['secondary']} */ ;
        const { default: __VLS_5 } = __VLS_3.slots;
        // @ts-ignore
        [section, section, message, message, error, error, createActivity, activityForm, activityForm, activityForm, activityForm, activities, activities,];
        var __VLS_3;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (activity.dueDate);
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
            value: (__VLS_ctx.outcomes[activity.id]),
            rows: "3",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.section === 'activities'))
                        throw 0;
                    return (__VLS_ctx.saveOutcomes(activity.id));
                    // @ts-ignore
                    [outcomes, saveOutcomes,];
                } },
            ...{ class: "button secondary" },
            type: "button",
        });
        /** @type {__VLS_StyleScopedClasses['button']} */ ;
        /** @type {__VLS_StyleScopedClasses['secondary']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "association-row" },
        });
        /** @type {__VLS_StyleScopedClasses['association-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.selectedRubrics[activity.id]),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: (undefined),
        });
        for (const [rubric] of __VLS_vFor((__VLS_ctx.rubrics))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (rubric.id),
                value: (rubric.id),
            });
            (rubric.name);
            // @ts-ignore
            [selectedRubrics, rubrics,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.section === 'activities'))
                        throw 0;
                    return (__VLS_ctx.associateRubric(activity.id));
                    // @ts-ignore
                    [associateRubric,];
                } },
            ...{ class: "button secondary" },
            type: "button",
        });
        /** @type {__VLS_StyleScopedClasses['button']} */ ;
        /** @type {__VLS_StyleScopedClasses['secondary']} */ ;
        // @ts-ignore
        [];
    }
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.form, __VLS_intrinsics.form)({
        ...{ onSubmit: (__VLS_ctx.createRubric) },
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
        required: true,
        maxlength: "160",
    });
    (__VLS_ctx.rubricName);
    for (const [criterion, index] of __VLS_vFor((__VLS_ctx.criteria))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({
            key: (index),
            ...{ class: "criterion-box" },
        });
        /** @type {__VLS_StyleScopedClasses['criterion-box']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
        (index + 1);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "form-grid" },
        });
        /** @type {__VLS_StyleScopedClasses['form-grid']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            required: true,
            maxlength: "120",
        });
        (criterion.name);
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            required: true,
            maxlength: "120",
        });
        (criterion.dimension);
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
            value: (criterion.descriptors.level1),
            rows: "2",
            required: true,
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
            value: (criterion.descriptors.level2),
            rows: "2",
            required: true,
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
            value: (criterion.descriptors.level3),
            rows: "2",
            required: true,
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
            value: (criterion.descriptors.level4),
            rows: "2",
            required: true,
        });
        if (__VLS_ctx.criteria.length > 1) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.section === 'activities'))
                            throw 0;
                        if (!(__VLS_ctx.criteria.length > 1))
                            throw 0;
                        return (__VLS_ctx.criteria.splice(index, 1));
                        // @ts-ignore
                        [createRubric, rubricName, criteria, criteria, criteria,];
                    } },
                ...{ class: "text-button danger" },
                type: "button",
            });
            /** @type {__VLS_StyleScopedClasses['text-button']} */ ;
            /** @type {__VLS_StyleScopedClasses['danger']} */ ;
        }
        // @ts-ignore
        [];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.section === 'activities'))
                    throw 0;
                return (__VLS_ctx.criteria.push(__VLS_ctx.emptyCriterion()));
                // @ts-ignore
                [criteria, emptyCriterion,];
            } },
        ...{ class: "button secondary" },
        type: "button",
    });
    /** @type {__VLS_StyleScopedClasses['button']} */ ;
    /** @type {__VLS_StyleScopedClasses['secondary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ class: "button primary" },
    });
    /** @type {__VLS_StyleScopedClasses['button']} */ ;
    /** @type {__VLS_StyleScopedClasses['primary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "section-block" },
    });
    /** @type {__VLS_StyleScopedClasses['section-block']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "section-title" },
    });
    /** @type {__VLS_StyleScopedClasses['section-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.rubrics.length);
    for (const [rubric] of __VLS_vFor((__VLS_ctx.rubrics))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
            key: (rubric.id),
            ...{ class: "panel" },
        });
        /** @type {__VLS_StyleScopedClasses['panel']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
        (rubric.name);
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (rubric.criteria.length);
        for (const [criterion, index] of __VLS_vFor((rubric.criteria))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
                key: (index),
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({});
            (criterion.name);
            (criterion.dimension);
            __VLS_asFunctionalElement1(__VLS_intrinsics.ol, __VLS_intrinsics.ol)({});
            for (const [level] of __VLS_vFor((4))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
                    key: (level),
                });
                (level);
                (criterion.descriptors[`level${level}`]);
                // @ts-ignore
                [rubrics, rubrics,];
            }
            // @ts-ignore
            [];
        }
        // @ts-ignore
        [];
    }
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
