import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { SQLiteTable, SQLiteColumn } from 'drizzle-orm/sqlite-core';
import { Refused, refusalStatus } from './planner/refused';
import type { LessonChange } from './planner/lessons';
import type { Db } from './planner/derive';

// The API door's one mapping of the seam's refusal: `{ error: message }` with the status the
// refusal's kind carries. Anything else was not thrown deliberately — it rethrows, so an
// unexpected fault is the 500 the framework serves, never a 4xx dressed as a bad request.
export function refusalJson(error: unknown): Response {
	if (!(error instanceof Refused)) throw error;
	return json({ error: error.message }, { status: refusalStatus(error.kind) });
}

// A plain JSON object — not `null`, an array, or a scalar. A write body is one, and so is every
// nested object it carries (an Import's `course`, `topic` and each Lesson), so one predicate
// decides what "an object" means everywhere the API narrows an untyped value.
export function jsonObject(value: unknown): Record<string, unknown> | null {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

// Every route reads its JSON body through here. A body that does not parse — `{`, an empty
// string — and one that parses to something other than an object — `null`, an array, a number —
// are the same 400 the spec gives a malformed body (§3.3), never the framework's 500.
export async function readJson(request: Request): Promise<Record<string, unknown> | Response> {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		body = null;
	}
	const object = jsonObject(body);
	return object ?? json({ error: 'The body must be a JSON object.' }, { status: 400 });
}

// Every route needs its target row to exist before it reads or writes further. Returns the 404
// Response to return as-is, or null once the row is confirmed present.
export function requireExisting<T extends SQLiteTable & { id: SQLiteColumn }>(
	db: Db,
	table: T,
	id: string,
	notFoundMessage: string
): Response | null {
	const [existing] = db.select({ id: table.id }).from(table).where(eq(table.id, id)).all();
	return existing ? null : json({ error: notFoundMessage }, { status: 404 });
}

// The API door's one type check. The seam takes names, titles, labels, urls and statuses as
// strings and runs every value rule itself (ADR-0025); a body that sends something else is
// refused here, before the seam is called.
export function stringField(value: unknown, name: string): string | Response {
	if (typeof value !== 'string') {
		return json({ error: `The "${name}" field must be a string.` }, { status: 400 });
	}
	return value;
}

// The Lesson fields three routes take — create, PATCH and Import — checked once so the messages
// cannot drift. An absent field is left out of the change: PATCH reads that as "unchanged" and a
// create reads it as "the default". Whether a title is needed is a value rule, and stays in the
// seam (§3.6).
export function lessonFields(data: Record<string, unknown>): LessonChange | Response {
	const fields: LessonChange = {};

	if (data.title !== undefined) {
		const title = stringField(data.title, 'title');
		if (title instanceof Response) return title;
		fields.title = title;
	}

	if (data.body !== undefined) {
		if (data.body !== null && typeof data.body !== 'string') {
			return json({ error: 'The "body" field must be a string or null.' }, { status: 400 });
		}
		fields.body = data.body;
	}

	if (data.length !== undefined) {
		if (typeof data.length !== 'number') {
			return json({ error: 'The "length" field must be a number.' }, { status: 400 });
		}
		fields.length = data.length;
	}

	if (data.status !== undefined) {
		const status = stringField(data.status, 'status');
		if (status instanceof Response) return status;
		fields.status = status;
	}

	return fields;
}
