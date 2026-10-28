// The ask every delete form shares. A delete that something depends on — a Course or Topic that
// still holds Lessons, a Class with a timetable, a Lesson a Sequence holds — comes back from the
// seam as an `unconfirmed` refusal. That answer fills `pending` with what the dialog needs: the
// action to post again, the row and its name, and the reason. The dialog then posts the same
// action with `confirmed`.
import type { ActionResult, SubmitFunction } from '@sveltejs/kit';
import { failureReason } from './enhance';

// What a pending delete shows, and the action its confirmed post goes to.
export type PendingDelete = {
	action: string;
	id: string;
	name: string;
	description: string;
};

// The first, unconfirmed post. `describe` names the row from the form that submitted it.
//
// `settled` handles every answer that is not a question — a delete that went at once, or a
// refusal that confirming cannot fix (the Lesson page toasts those and leaves). Without one the
// ordinary action handling refreshes the page. `update` is passed through so a caller can decide
// whether the ordinary handling should run.
export function createDeleteAsk(
	describe: (data: FormData) => { id: string; name: string },
	settled?: (result: ActionResult, update: () => Promise<void>) => Promise<void> | void
) {
	let pending = $state<PendingDelete | null>(null);

	const ask: SubmitFunction = ({ action, formData }) => {
		const { id, name } = describe(formData);
		return async ({ result, update }) => {
			if (result.type === 'failure' && result.data?.needsConfirm) {
				pending = {
					// The form's own `?/deleteX` query is the action the dialog posts again.
					action: action.search,
					id,
					name,
					description: failureReason(result, 'Delete it?')
				};
				return;
			}
			if (settled) await settled(result, () => update());
			else await update();
		};
	};

	return {
		get pending() {
			return pending;
		},
		set pending(value: PendingDelete | null) {
			pending = value;
		},
		ask
	};
}
