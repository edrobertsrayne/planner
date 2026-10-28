// The API door's shared pieces: one wrapper that turns a thrown failure into the spec's
// `{ error }` body, one thrown failure type for the door's own 4xx answers, and the readers that
// check a request body's shape before the seam sees it.
import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { SQLiteTable, SQLiteColumn } from 'drizzle-orm/sqlite-core';
import { Refused, refusalStatus } from './planner/refused';
import type { LessonChange } from './planner/lessons';
import type { Db } from './planner/derive';

// A failure the route itself decided: a body field of the wrong type, or a record the URL names
// that the database does not hold. It is thrown, not returned, so the route reads as one flow and
// the wrapper is the only place that writes a failure response.
export class ApiFailure extends Error {
	constructor(
		readonly status: number,
		message: string
	) {
		super(message);
		this.name = 'ApiFailure';
	}
}

// The route's own 404: the id in the URL is wrong. Never a refusal — the seam returns undefined
// for a row it does not hold, and the door names it here.
export function notFound(message: string): never {
	throw new ApiFailure(404, message);
}

// A plain JSON object — not `null`, an array, or a scalar. A write body is one, and so is every
// nested object it carries (an Import's `course`, `topic` and each Lesson), so one predicate
// decides what "an object" means everywhere the API narrows an untyped value.
export function jsonObject(value: unknown): Record<string, unknown> | null {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

// One API route: the handler answers its success, and anything it throws becomes the spec's one
// failure shape. `ApiFailure` carries the status the door chose; `Refused` takes the status its
// kind names, so a clash is a 409 and a missing parent a 404 from the same table the form door
// uses. Anything else was not thrown deliberately and is left to the framework's 500.
export function apiRoute<Event extends { request: Request }>(
	handle: (event: Event) => Response | Promise<Response>
): (event: Event) => Promise<Response> {
	return async (event) => {
		try {
			return await handle(event);
		} catch (error) {
			if (error instanceof ApiFailure)
				return json({ error: error.message }, { status: error.status });
			if (error instanceof Refused)
				return json({ error: error.message }, { status: refusalStatus(error.kind) });
			throw error;
		}
	};
}

// Every route reads its JSON body through here. A body that does not parse — `{`, an empty
// string — and one that parses to something other than an object — `null`, an array, a number —
// are the same 400 the spec gives a malformed body (§3.3), never the framework's 500.
export async function readJson(request: Request): Promise<Record<string, unknown>> {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		body = null;
	}
	const object = jsonObject(body);
	if (!object) throw new ApiFailure(400, 'The body must be a JSON object.');
	return object;
}

// Every route needs its target row to exist before it reads or writes further. A missing one is
// the route's 404.
export function requireExisting<T extends SQLiteTable & { id: SQLiteColumn }>(
	db: Db,
	table: T,
	id: string,
	notFoundMessage: string
): void {
	const [existing] = db.select({ id: table.id }).from(table).where(eq(table.id, id)).all();
	if (!existing) notFound(notFoundMessage);
}

// The API door's one type check. The seam takes names, titles, labels, urls and statuses as
// strings and runs every value rule itself (ADR-0025); a body that sends something else is
// refused here, before the seam is called.
export function stringField(value: unknown, name: string): string {
	if (typeof value !== 'string') {
		throw new ApiFailure(400, `The "${name}" field must be a string.`);
	}
	return value;
}

// The Lesson fields three routes take — create, PATCH and Import — checked once so the messages
// cannot drift. An absent field is left out of the change: PATCH reads that as "unchanged" and a
// create reads it as "the default". Whether a title is needed is a value rule, and stays in the
// seam (§3.6).
export function lessonFields(data: Record<string, unknown>): LessonChange {
	const fields: LessonChange = {};

	if (data.title !== undefined) fields.title = stringField(data.title, 'title');

	if (data.body !== undefined) {
		if (data.body !== null && typeof data.body !== 'string') {
			throw new ApiFailure(400, 'The "body" field must be a string or null.');
		}
		fields.body = data.body;
	}

	if (data.length !== undefined) {
		if (typeof data.length !== 'number') {
			throw new ApiFailure(400, 'The "length" field must be a number.');
		}
		fields.length = data.length;
	}

	if (data.status !== undefined) fields.status = stringField(data.status, 'status');

	return fields;
}
