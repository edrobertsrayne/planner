// The Event page's Notes tab: occurrences are one per held position, but a note belongs to an Event
// and a date (ADR-0029), so the tab has one date, with every position held on it, per chip in its strip.
type Occurrence = { date: string; position: number; room: string | null; note: string | null };

export interface DateCard {
	date: string;
	positions: { position: number; room: string | null }[];
	note: string | null;
}

export function notesByDate(occurrences: readonly Occurrence[]): DateCard[] {
	const cards: DateCard[] = [];
	for (const o of occurrences) {
		const last = cards[cards.length - 1];
		const held = { position: o.position, room: o.room };
		if (last && last.date === o.date) last.positions.push(held);
		else cards.push({ date: o.date, positions: [held], note: o.note });
	}
	return cards;
}

// The date the Notes tab opens on: the one a link names if the Event has it, else the next date
// (today counts) to plan, else the latest to log. An Event with no dates opens on none.
export function openDate(cards: readonly DateCard[], today: string, focus: string | null) {
	if (focus && cards.some((c) => c.date === focus)) return focus;
	return (cards.find((c) => c.date >= today) ?? cards.at(-1))?.date ?? null;
}

// What was last written before a date, shown beside it so the next date is planned with it in view.
// Dates with no note are skipped: an empty box says nothing.
export function earlierNote(cards: readonly DateCard[], date: string) {
	const found = cards.findLast((c) => c.date < date && c.note);
	return found ? { date: found.date, note: found.note! } : null;
}
