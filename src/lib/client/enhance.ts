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
	return goto(href, NAVIGATION);
}

// A failed action's reason, as the seam wrote it for Ed to read. Narrowed rather than asserted:
// an action can fail without setting one.
export function failureReason(result: ActionResult, fallback: string): string {
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
			if (result.type === 'failure') toast.error(failureReason(result, fallback));
			else await update({ invalidateAll: true });
		};
}

// Refresh the page data and nothing else — the plain case, where the form has no failure of its
// own to report.
export const refresh: SubmitFunction =
	() =>
	async ({ update }) =>
		update({ invalidateAll: true });

// The id of the row an action just created, when it returned one under `key`.
export function createdId(result: ActionResult, key: string): string | null {
	if (result.type !== 'success') return null;
	const created = result.data?.[key];
	if (typeof created !== 'object' || created === null) return null;
	const id = (created as { id?: unknown }).id;
	return typeof id === 'string' ? id : null;
}

// A create-and-clear box must be ready for the next entry as soon as the write lands: Ed types a
// name, presses Enter, and types the next one. A form reset leaves the box focused but with no
// caret in Chrome, and `focus()` on the element that already holds focus does nothing — so the
// box is emptied by hand, and the caret comes back only after a blur.
export function readyForNext(input: HTMLInputElement | null): void {
	if (!input) return;
	input.value = '';
	input.blur();
	input.focus();
}

// Creating a Course, a Topic or a Lesson selects it: the three-pane Courses view is driven by the
// query string, so the new row is opened by navigating to it. A failed create falls back to the
// ordinary action handling, which puts the error on the page.
export function createThenSelect(
	key: string,
	href: (id: string) => string,
	input: () => HTMLInputElement | null
): SubmitFunction {
	return () =>
		async ({ result }) => {
			const id = createdId(result, key);
			if (id === null) return applyAction(result);

			// The name just written must not sit in the box while the new row loads, and the caret
			// goes back only once the panes have settled.
			const box = input();
			if (box) box.value = '';
			await replaceQuery(href(id));
			readyForNext(input());
		};
}

// A Select that submits its own form: the picked value goes into the form's hidden input, which
// then submits. A Select cannot be a submit button, and the alternative — a separate "Assign"
// button beside it — is a second click for a one-step choice. `namedItem` is typed for the
// general case (it can return a RadioNodeList), hence the one narrowing here rather than at each
// call site.
export function submitWithValue(
	form: HTMLFormElement | undefined,
	field: string,
	value: string | undefined
): void {
	if (!form || !value) return;
	(form.elements.namedItem(field) as HTMLInputElement).value = value;
	form.requestSubmit();
}
