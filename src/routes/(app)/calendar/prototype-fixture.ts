// PROTOTYPE — throwaway. Delete with PrototypeStates.svelte once a variant wins.
//
// A hand-made Teaching Week that holds all four states at once, because the dev database has no
// Classes and no Lessons. The question is only what the states should look like, so fixture data
// is enough: w/c Mon 22 Mar 2027, the Term closing on the Thursday.
//   Mon — teaching, with a Blocked Slot
//   Tue — teaching
//   Wed — a Blocked Day (INSET), carrying a Blocked Slot of its own
//   Thu — teaching, the last day of Term
//   Fri — a School Holiday, outside every Term, carrying a Blocked Slot of its own

export type Kind = 'lesson' | 'open' | 'blocked';
export type DayKind = 'teaching' | 'blocked' | 'holiday';

export interface Cell {
	period: number;
	span: number;
	classLabel: string;
	tone: number;
	kind: Kind;
	title?: string;
	topicName?: string;
	note?: string;
	// A Blocked Slot rather than a Slot drained by the day around it. It carries its own unblock,
	// and a collapsed column is where that control goes missing.
	blockedSlot?: boolean;
}

export interface Day {
	name: string;
	date: string;
	kind: DayKind;
	note?: string;
	cells: Cell[];
}

export const PERIODS = [1, 2, 3, 4, 5, 6];

const lesson = (
	period: number,
	classLabel: string,
	tone: number,
	title: string,
	topicName: string,
	span = 1
): Cell => ({ period, span, classLabel, tone, kind: 'lesson', title, topicName });

const open = (period: number, classLabel: string, tone: number): Cell => ({
	period,
	span: 1,
	classLabel,
	tone,
	kind: 'open'
});

const blocked = (period: number, classLabel: string, tone: number, note?: string): Cell => ({
	period,
	span: 1,
	classLabel,
	tone,
	kind: 'blocked',
	note
});

const blockedSlot = (period: number, classLabel: string, tone: number, note: string): Cell => ({
	period,
	span: 1,
	classLabel,
	tone,
	kind: 'blocked',
	note,
	blockedSlot: true
});

export const WEEK: Day[] = [
	{
		name: 'Mon',
		date: '22 Mar',
		kind: 'teaching',
		cells: [
			lesson(1, '8Y/Sc2', 0, 'Speed, distance and time', 'Forces and motion'),
			lesson(3, '9B/Sc1', 4, 'Required practical: rates', 'Rates of reaction', 2),
			blocked(5, '7A/Sc3', 6, 'Science fair rehearsal'),
			open(6, '10C/Ph1', 7)
		]
	},
	{
		name: 'Tue',
		date: '23 Mar',
		kind: 'teaching',
		cells: [
			open(2, '7A/Sc3', 6),
			lesson(3, '8Y/Sc2', 0, 'Balanced and unbalanced forces', 'Forces and motion'),
			lesson(5, '10C/Ph1', 7, 'Momentum in collisions', 'Momentum')
		]
	},
	{
		name: 'Wed',
		date: '24 Mar',
		kind: 'blocked',
		note: 'INSET day',
		cells: [blocked(2, '9B/Sc1', 4, 'INSET day'), blockedSlot(4, '8Y/Sc2', 0, 'Cover for the trip')]
	},
	{
		name: 'Thu',
		date: '25 Mar',
		kind: 'teaching',
		cells: [
			lesson(1, '9B/Sc1', 4, 'Reversible reactions', 'Rates of reaction'),
			lesson(2, '7A/Sc3', 6, 'Separating mixtures', 'Particles'),
			open(4, '8Y/Sc2', 0),
			lesson(5, '10C/Ph1', 7, 'Conservation of momentum', 'Momentum', 2)
		]
	},
	{
		name: 'Fri',
		date: '26 Mar',
		kind: 'holiday',
		note: 'School holiday',
		cells: [
			blocked(1, '7A/Sc3', 6),
			blockedSlot(3, '10C/Ph1', 7, 'Revision session, called off'),
			blocked(5, '9B/Sc1', 4)
		]
	}
];

// One entry per (day, Period) so a variant can walk the grid the way the real page does.
export type Entry = { type: 'start'; cell: Cell } | { type: 'covered' } | { type: 'free' };

export function toGrid(days: Day[]): Entry[][] {
	const matrix: Entry[][] = days.map(() => PERIODS.map((): Entry => ({ type: 'free' })));
	days.forEach((day, di) => {
		for (const cell of day.cells) {
			matrix[di][cell.period - 1] = { type: 'start', cell };
			for (let p = cell.period + 1; p < cell.period + cell.span; p++)
				matrix[di][p - 1] = { type: 'covered' };
		}
	});
	return matrix;
}
