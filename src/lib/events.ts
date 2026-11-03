// What the pages need to know about Events that is not a rule: the kinds as the teacher names
// them, and the eight positions of a day (ADR-0029). The rules themselves live in the planner seam.
export const EVENT_KINDS = [
	{ value: 'meeting', label: 'Meeting' },
	{ value: 'club', label: 'Club' },
	{ value: 'intervention', label: 'Intervention' },
	{ value: 'other', label: 'Other' }
] as const;

export type EventKindValue = (typeof EVENT_KINDS)[number]['value'];

export const kindLabel = (kind: string) => EVENT_KINDS.find((k) => k.value === kind)?.label ?? kind;

// 0 Before school, 1 to 6 the Periods, 7 After school: the order a day's rows are drawn in.
export const POSITIONS = [0, 1, 2, 3, 4, 5, 6, 7];

// The short label a grid row carries: P3, or the words for the two positions only Events hold.
export const positionLabel = (position: number) =>
	position === 0 ? 'Before school' : position === 7 ? 'After school' : `P${position}`;

// "P3", "P1–P2", or the words for Before school and After school: where an Event sits in a day.
export const positionRangeLabel = (from: number, to: number) =>
	from === to ? positionLabel(from) : `${positionLabel(from)}–${positionLabel(to)}`;

// One Event over adjacent Periods is one occurrence to the teacher, since its note belongs to the
// Event and the date, not to a position. Joins each run of adjacent Periods (P1 to P6) of one Event
// on one date, given in date then position order, into its first occurrence, which gains
// `positionTo`. Before school and After school are bands of their own and never join. The room is
// the distinct rooms the run holds, in order.
export function joinAdjacentPeriods<
	O extends { eventId: string; date: string; position: number; room: string | null }
>(occurrences: readonly O[]): (O & { positionTo: number })[] {
	const out: (O & { positionTo: number })[] = [];
	for (const o of occurrences) {
		const last = out[out.length - 1];
		if (
			last &&
			last.eventId === o.eventId &&
			last.date === o.date &&
			last.positionTo === o.position - 1 &&
			last.position >= 1 &&
			o.position <= 6
		) {
			last.positionTo = o.position;
			const rooms = [...new Set([last.room, o.room].flatMap((r) => (r ? r.split(', ') : [])))];
			last.room = rooms.length > 0 ? rooms.join(', ') : null;
		} else {
			out.push({ ...o, positionTo: o.position });
		}
	}
	return out;
}
