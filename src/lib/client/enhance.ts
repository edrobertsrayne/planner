// What `use:enhance` does on this app's forms: refresh the page data, toast the server's reason
// on a refusal, create in place, create-then-select, and hand one hidden form its fields.
//
// A form action's `result.data` is typed as a loose record, so each of these reads it in one
// place rather than casting at the call site.
import { applyAction } from '$app/forms';
import { goto, invalidateAll } from '$app/navigation';
import type { ActionResult, SubmitFunction } from '@sveltejs/kit';
import type { SequenceResult } from '$lib/sequence-text';
import type { WriteReport } from '$lib/server/planner';
import { toast } from '$lib/ui/toast';

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

// The seam writes its refusals for Ed to read — "This Lesson was taught, so it cannot be
// removed." — so a failure shows that reason and leaves the page as it was. Anything else runs
// `onSuccess`, if given, and refreshes.
export function onFail(fallback: string, onSuccess?: () => void): SubmitFunction {
	return () =>
		async ({ result, update }) => {
			if (result.type === 'failure') toast.error(failureReason(result, fallback));
			else {
				onSuccess?.();
				await update({ invalidateAll: true });
			}
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
	const created: unknown = result.data?.[key];
	if (typeof created !== 'object' || created === null) return null;
	const id = 'id' in created ? created.id : undefined;
	return typeof id === 'string' ? id : null;
}

// The Rewind report a successful action answered with, when it carried one under `report`. The
// action typed its answer and the server checked it, so it is read, not checked again.
export function reportOfResult(
	result: ActionResult<{ report?: WriteReport | null }>
): WriteReport | null {
	return result.type === 'success' ? (result.data?.report ?? null) : null;
}

// Whether a report has anything to show. A toast for an empty report would be blank.
export function hasReport(report: WriteReport | null): report is WriteReport {
	return !!report && report.placementsMoved.length > 0;
}

// The Sequence outcome a successful Sequence action answered with, under `sequenceResult` — the
// one shape Assign Topic, Move, Add and Remove all answer with.
export function sequenceOfResult(
	result: ActionResult<{ sequenceResult?: SequenceResult }>
): SequenceResult | null {
	return result.type === 'success' ? (result.data?.sequenceResult ?? null) : null;
}

// A create box that stays where it is: the new row appears in the list above it, and the box is
// ready for the next entry. `applyAction` ends a success with SvelteKit's own `reset_focus`, which
// takes the caret out of the box — so a success refreshes the data and nothing else, and only a
// refusal goes through the ordinary action handling to put its reason on the page.
export function createInPlace(clear: () => void): SubmitFunction {
	return () =>
		async ({ result }) => {
			if (result.type !== 'success') return applyAction(result);
			clear();
			await invalidateAll();
		};
}

// Creating a Course or a Topic selects it: the Course page is driven by its address, so the new
// row is opened by navigating to it. A failed create falls back to the
// ordinary action handling, which puts the error on the page.
export function createThenSelect(
	key: string,
	href: (id: string) => string,
	clear: () => void
): SubmitFunction {
	return () =>
		async ({ result }) => {
			const id = createdId(result, key);
			if (id === null) return applyAction(result);

			// The name just written must not sit in the box while the new row loads. The caret stays
			// where it is: `NAVIGATION` keeps the focus, so nothing blurs the box.
			clear();
			await replaceQuery(href(id));
		};
}

// A hidden form submitted from a menu item, a Select or a drag: the action and every field it
// needs are written just before the one submit. A field the markup already carries is filled in
// place; one it does not is added, so a caller never has to keep a spare input in the template.
// `namedItem` is typed for the general case (it can return a RadioNodeList), hence the one test
// here rather than at each call site.
export function submitForm(
	form: HTMLFormElement | undefined,
	{ action, fields }: { action?: string; fields: Record<string, string | undefined> }
): void {
	if (!form) return;
	if (action) form.action = action;

	// A hidden form reused for several actions drops the fields an earlier call added that this
	// call does not set, so a stale `date` cannot ride along with a later `id`.
	for (const added of form.querySelectorAll('input[data-submit-form]')) {
		if (added instanceof HTMLInputElement && !Object.hasOwn(fields, added.name)) added.remove();
	}

	for (const [name, value] of Object.entries(fields)) {
		if (!value) continue;
		const existing = form.elements.namedItem(name);
		let input: HTMLInputElement;
		if (existing instanceof HTMLInputElement) input = existing;
		else {
			input = document.createElement('input');
			input.type = 'hidden';
			input.name = name;
			input.dataset.submitForm = '';
			form.append(input);
		}
		input.value = value;
	}

	form.requestSubmit();
}
