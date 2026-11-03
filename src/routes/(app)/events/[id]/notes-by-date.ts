// The Event page's Notes tab: occurrences are one per held position, but a note belongs to an Event
// and a date (ADR-0029), so the tab shows one card per date carrying every position held on it.
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
