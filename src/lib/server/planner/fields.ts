// The value rules every write applies to the fields a teacher types (ADR-0025). Each door — a
// form action, the planning API, the Session routes — only turns its request into typed
// arguments; the seam's writers run these rules, so one rule holds at every entry point and
// refuses with one message. Only a value that would break something has a rule: an empty name,
// a Link url that is not http(s), a Length the layout cannot draw, a status the database
// refuses. No size limit exists — the request body limit bounds every write.
import { Refused } from './refused';

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

export function lessonStatus(status: string): 'draft' | 'planned' {
	if (status !== 'draft' && status !== 'planned') {
		throw new Refused('invalid', 'A Lesson must be Draft or Planned.');
	}
	return status;
}

// A blank plan is no plan. A plan with words in it is stored as typed: Markdown gives its
// whitespace meaning (ADR-0023), so the body is never trimmed.
export function lessonBody(body: string | null): string | null {
	return body?.trim() ? body : null;
}
