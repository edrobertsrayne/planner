// The three things every form action does before it can call the seam: read a field, turn a
// refusal from the seam into a failure the page can show, and check that the row a URL or a form
// names is there.
import { fail } from '@sveltejs/kit';
import { Refused, refusalStatus } from './planner/refused';

export function trimmed(data: FormData, field: string): string {
	return String(data.get(field) ?? '').trim();
}

// A row the form or the URL names but the database does not hold is the door's 404, with the
// message the pages have always used for it.
export function found<Row>(row: Row | undefined | null, noun: string): Row {
	if (row === undefined || row === null) throw new Refused('missing', `No such ${noun}.`);
	return row;
}

// The seam refuses a write by throwing `Refused` with a message already written for Ed — "This
// Lesson was taught, so it cannot be removed." — and a kind that says which class of
// refusal it is. The form door answers every refusal with the same failure shape, `{ error }`,
// and takes its status from the kind. An `unconfirmed` refusal also carries `needsConfirm`, the
// flag the page's dialog watches for before it asks again with `confirmed`. Anything else was not
// thrown deliberately: it rethrows, so an unexpected fault reaches the error page as the 500 it
// is, never a 400 dressed as a bad request.
export function refusal(error: unknown) {
	if (!(error instanceof Refused)) throw error;
	const data =
		error.kind === 'unconfirmed'
			? { error: error.message, needsConfirm: true }
			: { error: error.message };
	return fail(refusalStatus(error.kind), data);
}

// One form action: read the form, call the seam, and answer a refusal with the one failure shape.
// Every action in the app goes through here, so a seam that starts throwing somewhere new cannot
// turn a refusal into a 500 just because that action forgot its own `try`.
export function formAction<Output extends Record<string, unknown> | void>(
	run: (data: FormData) => Output | Promise<Output>
) {
	return async ({ request }: { request: Request }) => {
		try {
			return await run(await request.formData());
		} catch (error) {
			return refusal(error);
		}
	};
}
