// The value rules every write applies to the fields a teacher types (ADR-0025). Each door — a
// form action, the planning API, the Session routes — only turns its request into typed
// arguments; the seam's writers run these rules, so one rule holds at every entry point and
// refuses with one message. Only a value that would break something has a rule: an empty name,
// a Link url that is not http(s), a Length the layout cannot draw, a status the database
// refuses. No size limit exists — the request body limit bounds every write.
//
// The writers' shared guards live here too: `sameName` for the case-insensitive name comparison
// and `requireRow` for a record the request names but the database does not hold.
import { eq, sql, type SQL } from 'drizzle-orm';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { LESSON_STATUSES, type LessonStatus } from '$lib/lesson-status';
import { Refused } from './refused';
import type { Db } from './derive';

// A name equals another case-insensitively — the comparison every unique Course, Topic and Tag
// name shares. Both sides are already trimmed by the caller.
export function sameName(column: SQLiteColumn, name: string): SQL<unknown> {
	return sql`lower(${column}) = lower(${name})`;
}

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

// A Slot's position is (Week, Day, Period). A form sends it as strings, and the database's own
// range checks would surface as a raw constraint error, so the seam refuses a position it cannot
// draw first, with a message the teacher can read.
export function slotWeek(week: string): 'A' | 'B' {
	if (week !== 'A' && week !== 'B') {
		throw new Refused('invalid', 'A Slot must be in Week A or Week B.');
	}
	return week;
}

export function slotDay(day: number): number {
	if (!Number.isInteger(day) || day < 1 || day > 5) {
		throw new Refused('invalid', "A Slot's Day must be a whole number from 1 to 5.");
	}
	return day;
}

export function slotPeriod(period: number): number {
	if (!Number.isInteger(period) || period < 1 || period > 6) {
		throw new Refused('invalid', "A Slot's Period must be a whole number from 1 to 6.");
	}
	return period;
}

// A blank plan is no plan. A plan with words in it is stored as typed: Markdown gives its
// whitespace meaning (ADR-0023), so the body is never trimmed.
export function lessonBody(body: string | null): string | null {
	return body?.trim() ? body : null;
}
