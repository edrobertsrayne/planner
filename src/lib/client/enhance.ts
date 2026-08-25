// What `use:enhance` does on this app's forms. Three shapes cover every form: refresh the page
// data, toast the server's reason on a refusal, and create-then-select.
//
// A form action's `result.data` is typed as a loose record, so each of these narrows it in one
// place rather than casting at the call site.
import { applyAction } from '$app/forms';
import { goto } from '$app/navigation';
import type { ActionResult, SubmitFunction } from '@sveltejs/kit';
import { toast } from 'svelte-sonner';

// A write can move dates on a screen other than the one it was made from — assigning a Topic
// changes the Class lane above it — so every enhanced form re-runs the loads rather than
// patching the form's own result in.
const NAVIGATION = { replaceState: true, noScroll: true, keepFocus: true, invalidateAll: true };

// Go to a URL on this page that differs only by its query string, without a history entry.
export function replaceQuery(href: string): Promise<void> {
	// eslint-disable-next-line svelte/no-navigation-without-resolve -- carries a query string
	return goto(href, NAVIGATION);
}

function reasonFor(result: ActionResult, fallback: string): string {
	if (result.type !== 'failure') return fallback;
	const reason = result.data?.error;
	return typeof reason === 'string' ? reason : fallback;
}

// The seam writes its refusals for Ed to read — "This Topic has already been taught and cannot be
// unassigned." — so a failure shows that reason and leaves the page as it was. Anything else
// refreshes.
export function onFail(fallback: string): SubmitFunction {
	return () =>
		async ({ result, update }) => {
			if (result.type === 'failure') toast.error(reasonFor(result, fallback));
			else await update({ invalidateAll: true });
		};
}

// Refresh the page data and nothing else — the plain case, where the form has no failure of its
// own to report.
export const refresh: SubmitFunction = () => async ({ update }) => update({ invalidateAll: true });

// The id of the row an action just created, when it returned one under `key`.
function createdId(result: ActionResult, key: string): string | null {
	if (result.type !== 'success') return null;
	const created = result.data?.[key];
	if (typeof created !== 'object' || created === null) return null;
	const id = (created as { id?: unknown }).id;
	return typeof id === 'string' ? id : null;
}

// Creating a Course, a Topic or a Lesson selects it: the three-pane Courses view is driven by the
// query string, so the new row is opened by navigating to it. A failed create falls back to the
// ordinary action handling, which puts the error on the page.
export function createThenSelect(
	key: string,
	href: (id: string) => string,
	focus?: () => void
): SubmitFunction {
	return () =>
		async ({ formElement, result }) => {
			const id = createdId(result, key);
			if (id === null) return applyAction(result);

			formElement.reset();
			await replaceQuery(href(id));
			focus?.();
		};
}
