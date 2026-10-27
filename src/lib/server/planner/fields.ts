// The value rules every write applies to the fields a teacher types (ADR-0025). Each door — a
// form action, the planning API, the Session routes — only turns its request into typed
// arguments; the seam's writers run these rules, so one rule holds at every entry point and
// refuses with one message. Only a value that would break something has a rule: an empty name,
// a Link url that is not http(s), a Length the layout cannot draw, a status the database
// refuses. No size limit exists — the request body limit bounds every write.
import { eq } from 'drizzle-orm';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { LESSON_STATUSES, type LessonStatus } from '$lib/lesson-status';
import { Refused } from './refused';
import type { Db } from './derive';

// A record the request names must exist before the write that hangs off it: a Lesson's Topic, a
// Tag's Lesson, a Class's Course. One guard for every create, so each refuses with the same kind
// and a message already written for the teacher to read.
export function requireRow<T extends SQLiteTable & { id: SQLiteColumn; $inferSelect: unknown }>(
	db: Db,
	table: T,
	id: string,
	message: string
): T['$inferSelect'] {
	const [row] = db.select().from(table).where(eq(table.id, id)).all();
	if (!row) throw new Refused('missing', message);
	return row as T['$inferSelect'];
}

// Trims a name, title, label or note, and refuses one that is empty after trimming.
export function required(value: string, message: string): string {
	const trimmed = value.trim();
	if (!trimmed) throw new Refused('invalid', message);
	return trimmed;
}

// A Link's url becomes a real href, so anything but http(s) — a `javascript:` url above all —
// never reaches the database.
export function linkUrl(value: string): string {
	const url = required(value, 'A Link needs a url.');
	let protocol = '';
	try {
		protocol = new URL(url).protocol;
	} catch {
		// Not a url at all: refused below with the same message as a wrong scheme.
	}
	if (protocol !== 'http:' && protocol !== 'https:') {
		throw new Refused('invalid', 'A Link must be an http(s) URL.');
	}
	return url;
}

// The Lesson's layout draws one part per Period, so a Length is a whole number of Periods, and
// 20 is more Periods than any Lesson needs.
export function lessonLength(length: number): number {
	if (!Number.isInteger(length) || length < 1 || length > 20) {
		throw new Refused('invalid', 'A Length must be a whole number of Periods from 1 to 20.');
	}
	return length;
}

export function lessonStatus(status: string): LessonStatus {
	if (!LESSON_STATUSES.includes(status as LessonStatus)) {
		throw new Refused('invalid', 'A Lesson must be Draft or Planned.');
	}
	return status as LessonStatus;
}

// A blank plan is no plan. A plan with words in it is stored as typed: Markdown gives its
// whitespace meaning (ADR-0023), so the body is never trimmed.
export function lessonBody(body: string | null): string | null {
	return body?.trim() ? body : null;
}
