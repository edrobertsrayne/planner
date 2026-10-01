import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { SQLiteTable, SQLiteColumn } from 'drizzle-orm/sqlite-core';
import { Refused, refusalStatus } from './planner/refused';
import type { Db } from './planner/derive';

// The API door's one mapping of the seam's refusal: `{ error: message }` with the status the
// refusal's kind carries. Anything else was not thrown deliberately — it rethrows, so an
// unexpected fault is the 500 the framework serves, never a 4xx dressed as a bad request.
export function refusalJson(error: unknown): Response {
	if (!(error instanceof Refused)) throw error;
	return json({ error: error.message }, { status: refusalStatus(error.kind) });
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
