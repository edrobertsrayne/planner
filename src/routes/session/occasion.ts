// A Session is identified by its occasion — Class, date, Period — never by a row id (ADR-0002),
// so both Session endpoints take that triple rather than an id, and both narrow it here. Anything
// that is not a complete occasion is a 400: there is no partial occasion to fall back to.
import { error } from '@sveltejs/kit';
import { jsonObject } from '$lib/server/api-helpers';
import { Refused, refusalStatus } from '$lib/server/planner';
import type { Occasion } from '$lib/server/planner';

// Every Session write reads its JSON body through here. A body that does not parse, or parses to
// something other than an object, is a 400, never the framework's 500.
export async function bodyOf(request: Request): Promise<Record<string, unknown>> {
	const body = jsonObject(await request.json().catch(() => null));
	if (!body) error(400, 'The body must be a JSON object.');
	return body;
}

export function occasionOf(input: Record<string, unknown>): Occasion {
	const classId = typeof input.classId === 'string' ? input.classId : '';
	const date = typeof input.date === 'string' ? input.date : '';
	const period = Number(input.period);
	if (!classId || !date || !Number.isInteger(period)) {
		error(400, 'classId, date and period are required.');
	}
	return { classId, date, period };
}

export function occasionFromQuery(params: URLSearchParams): Occasion {
	return occasionOf({
		classId: params.get('classId'),
		date: params.get('date'),
		period: params.get('period')
	});
}

// The Session routes' one mapping of the seam's refusal onto SvelteKit's own error throw: the
// status follows the refusal's kind, and the message passes straight through. Anything else was
// not thrown deliberately — it rethrows, so an unexpected fault is the 500 the framework serves,
// never a 4xx dressed as a bad request.
export function refusal(e: unknown): never {
	if (e instanceof Refused) error(refusalStatus(e.kind), e.message);
	throw e;
}
