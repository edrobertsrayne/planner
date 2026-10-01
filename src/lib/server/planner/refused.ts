// The seam's one refusal. Every write the planner refuses — a malformed input, a clash with what
// is already on record, or a record the request body names that is not there — leaves as a
// `Refused` throw, carrying a message already written for the teacher to read. A record addressed
// by a URL `:id` that does not exist is not a refusal: those functions return `undefined`, as
// they always have, and each door answers 404 itself.
//
// The kind says which class of refusal it is, and each door maps it with one helper of its own —
// `refusal` for form actions, `refusalJson` for the API, the Session routes' helper for `/session`.
// The table lives here so no door can drift from the others.
export type RefusalKind = 'invalid' | 'conflict' | 'missing';

export class Refused extends Error {
	constructor(
		readonly kind: RefusalKind,
		message: string
	) {
		super(message);
		this.name = 'Refused';
	}
}

// `invalid` — the request was bad on its own terms: 400.
// `conflict` — the request was fine but the write is refused as unsafe: 409.
// `missing` — the request body names a record that does not exist: 404.
export function refusalStatus(kind: RefusalKind): 400 | 404 | 409 {
	return kind === 'conflict' ? 409 : kind === 'missing' ? 404 : 400;
}
