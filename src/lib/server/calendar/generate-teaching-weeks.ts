// ADR-0005: a Teaching Week is a calendar week (Monday to Sunday) with at least one day that
// falls within a Term. Blocked Days reduce a week's teaching-day count but never remove it from
// the A/B cycle — only falling entirely outside every Term does that.

export interface TermInput {
	name: string;
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

function toDate(iso: string): Date {
	const [year, month, day] = iso.split('-').map(Number);
	return new Date(Date.UTC(year, month - 1, day));
}

function toIso(date: Date): string {
	return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
	const result = new Date(date);
	result.setUTCDate(result.getUTCDate() + days);
	return result;
}

function mondayOf(date: Date): Date {
	const day = date.getUTCDay();
	const diff = day === 0 ? -6 : 1 - day;
	return addDays(date, diff);
}

export function generateTeachingWeeks(
	terms: TermInput[],
	blockedDays: BlockedDayInput[]
): GeneratedTeachingWeek[] {
	const parsedTerms = [...terms]
		.map((term) => ({ ...term, opensDate: toDate(term.opens), closesDate: toDate(term.closes) }))
		.sort((a, b) => a.opensDate.getTime() - b.opensDate.getTime());

	const blockedDates = new Set(blockedDays.map((blockedDay) => blockedDay.date));

	const firstTerm = parsedTerms[0];
	const lastTerm = parsedTerms[parsedTerms.length - 1];
	if (!firstTerm || !lastTerm) return [];

	const weeks: GeneratedTeachingWeek[] = [];
	let cursor = mondayOf(firstTerm.opensDate);
	let letter: 'A' | 'B' = 'A';

	while (cursor <= lastTerm.closesDate) {
		const weekdays = Array.from({ length: 5 }, (_, index) => addDays(cursor, index));

		const termOf = (weekday: Date) =>
			parsedTerms.find(
				(candidate) => weekday >= candidate.opensDate && weekday <= candidate.closesDate
			);
		const inTermDays = weekdays.filter((weekday) => termOf(weekday) !== undefined);
		const termName = inTermDays.length > 0 ? (termOf(inTermDays[0])?.name ?? null) : null;

		if (inTermDays.length > 0 && termName !== null) {
			const blockedCount = inTermDays.filter((day) => blockedDates.has(toIso(day))).length;
			weeks.push({
				weekCommencing: toIso(cursor),
				letter,
				termName,
				teachingDays: inTermDays.length - blockedCount
			});
			letter = letter === 'A' ? 'B' : 'A';
		}

		cursor = addDays(cursor, 7);
	}

	return weeks;
}
