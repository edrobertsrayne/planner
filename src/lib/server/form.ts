// The two things every form action does before it can call the seam: read a field, and turn a
// refusal from the seam into a failure the page can show.
import { fail } from '@sveltejs/kit';
import { Refused, refusalStatus } from './planner/refused';

export function trimmed(data: FormData, field: string): string {
	return String(data.get(field) ?? '').trim();
}

// The seam refuses a write by throwing `Refused` with a message already written for Ed — "This
// Topic has already been taught and cannot be unassigned." — and a kind that says which class of
// refusal it is. The form door answers every refusal with the same failure shape, `{ error }`,
// and takes its status from the kind. Anything else was not thrown deliberately: it rethrows, so
// an unexpected fault reaches the error page as the 500 it is, never a 400 dressed as a bad
// request.
export function refusal(error: unknown) {
	if (!(error instanceof Refused)) throw error;
	return fail(refusalStatus(error.kind), { error: error.message });
}
