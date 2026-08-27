// The Terms seam. A Term is not a disruption, so it does not join the Blocked Day and Blocked
// Slot module — and the six Terms are never written one at a time: they are replaced as one
// document, because the Week letter is computed from them (ADR-0020) and a half-changed year is
// a planner with no year in it.
//
// Every rule lives here, not in a caller: the setup surface and the API are two doors on the
// same seam. The six are sorted by opening date before checking, so no caller has to order them.
// Gap length and weekend boundaries are not policed — the generator counts weekdays only, so a
// Saturday boundary is harmless, and nothing here has a view on how long a half-term break runs.
import type { Database } from 'bun:sqlite';
import * as schema from '../db/schema';
import { rederiveAllClasses, rewindBoundary, type AtRiskSession, type Db } from './derive';
import { isRealDate } from '$lib/date';
import type { TermInput } from '$lib/calendar/generate-teaching-weeks';

// Deletes the six Terms, inserts the new six, and re-derives every Class — in one transaction,
// driven on the raw client exactly as the Topic import already is. The re-derivation runs from
// the Rewind boundary of the earliest Term opening across the old and the new sets: a Term
// change can flip every letter, so a minimal boundary is nearly always the whole year, and
// computing it precisely would be complexity for nothing.
export function replaceTerms(
	db: Db,
	client: Database,
	{ terms, today }: { terms: TermInput[]; today: string }
): { ok: true; atRisk: AtRiskSession[] } | { ok: false; reason: string } {
	if (terms.length !== 6) {
		return { ok: false, reason: `A year needs exactly six Terms, and ${terms.length} were given.` };
	}

	for (const term of terms) {
		if (!isRealDate(term.opens))
			return { ok: false, reason: `"${term.opens}" is not a real date.` };
		if (!isRealDate(term.closes)) {
			return { ok: false, reason: `"${term.closes}" is not a real date.` };
		}
		if (term.opens > term.closes) {
			return {
				ok: false,
				reason: `A Term cannot open after it closes: opens ${term.opens}, closes ${term.closes}.`
			};
		}
	}

	// Two Terms that touch have no break between them, so they are one Term and not two.
	const sorted = [...terms].sort((a, b) => (a.opens < b.opens ? -1 : a.opens > b.opens ? 1 : 0));
	for (let i = 1; i < sorted.length; i++) {
		if (sorted[i - 1].closes >= sorted[i].opens) {
			return {
				ok: false,
				reason: `Terms cannot overlap or touch: one closes ${sorted[i - 1].closes}, the next opens ${sorted[i].opens}.`
			};
		}
	}

	const oldOpens = db
		.select({ opens: schema.term.opens })
		.from(schema.term)
		.all()
		.map((row) => row.opens);
	const boundary = rewindBoundary(
		[...oldOpens, ...sorted.map((term) => term.opens)].reduce((a, b) => (b < a ? b : a)),
		today
	);

	client.run('BEGIN');
	try {
		db.delete(schema.term).run();
		for (const term of sorted) {
			db.insert(schema.term).values({ opens: term.opens, closes: term.closes }).run();
		}
		const atRisk = rederiveAllClasses(db, boundary);
		client.run('COMMIT');
		return { ok: true, atRisk };
	} catch {
		client.run('ROLLBACK');
		return { ok: false, reason: 'Replacing the Terms failed.' };
	}
}
