// A Session is identified by its occasion — Class, date, Period — never by a row id (ADR-0002),
// so both Session endpoints take that triple rather than an id, and both narrow it here. Anything
// that is not a complete occasion is a 400: there is no partial occasion to fall back to.
import { error } from '@sveltejs/kit';
import type { Occasion } from '$lib/server/planner';

export function occasionOf(input: { classId: unknown; date: unknown; period: unknown }): Occasion {
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
