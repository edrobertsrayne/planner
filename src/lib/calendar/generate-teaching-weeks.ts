// ADR-0020: a Teaching Week is a calendar week (Monday to Sunday) with at least one day that
// falls within a Term. Blocked Days reduce a week's teaching-day count but never remove it from
// the A/B cycle — only falling entirely outside every Term does that.
//
// Pure, and shared between the server (the seam, the derivation, the API) and the browser (the
// setup mode's live preview) — one copy, so the preview can never derive a year the save would
// not.

import { addDays, weekday } from '$lib/date';

// A Term is named by its position in the year, never stored: six Terms in date order are always
// Autumn 1 through Summer 2, so a name can never contradict where the Term sits.
export const TERM_NAMES = ['Autumn 1', 'Autumn 2', 'Spring 1', 'Spring 2', 'Summer 1', 'Summer 2'];

export interface TermInput {
	opens: string;
	closes: string;
}

export interface BlockedDayInput {
	date: string;
	note?: string;
}

export interface GeneratedTeachingWeek {
	weekCommencing: string;
	letter: 'A' | 'B';
	termName: string;
	teachingDays: number;
}

export function generateTeachingWeeks(
	terms: TermInput[],
	blockedDays: BlockedDayInput[]
): GeneratedTeachingWeek[] {
	const namedTerms = [...terms]
		.sort((a, b) => (a.opens < b.opens ? -1 : a.opens > b.opens ? 1 : 0))
		.map((term, position) => ({ ...term, name: TERM_NAMES[position] }));

	const blockedDates = new Set(blockedDays.map((blockedDay) => blockedDay.date));

	const firstTerm = namedTerms[0];
	const lastTerm = namedTerms[namedTerms.length - 1];
	if (!firstTerm || !lastTerm) return [];

	const weeks: GeneratedTeachingWeek[] = [];
	const opensOn = weekday(firstTerm.opens);
	let cursor = addDays(firstTerm.opens, opensOn === 0 ? -6 : 1 - opensOn);
	let letter: 'A' | 'B' = 'A';

	while (cursor <= lastTerm.closes) {
		const weekdays = Array.from({ length: 5 }, (_, index) => addDays(cursor, index));

		const termOf = (day: string) =>
			namedTerms.find((candidate) => day >= candidate.opens && day <= candidate.closes);
		const inTermDays = weekdays.filter((day) => termOf(day) !== undefined);
		const term = inTermDays.length > 0 ? termOf(inTermDays[0]) : undefined;

		if (term) {
			const blockedCount = inTermDays.filter((day) => blockedDates.has(day)).length;
			weeks.push({
				weekCommencing: cursor,
				letter,
				termName: term.name,
				teachingDays: inTermDays.length - blockedCount
			});
			letter = letter === 'A' ? 'B' : 'A';
		}

		cursor = addDays(cursor, 7);
	}

	return weeks;
}
