// The day as the Bell Schedules draw it (ADR-0033): which rows a day has, in which order, and the
// clock times each one shows. The rules for writing a Bell Schedule live in the planner seam; this
// is only how the pages read one, so the Agenda, the Calendar and the Event page agree.

// Break and Lunch are positions 8 and 9, after the eight ADR-0029 gave a day.
export const BREAK = 8;
export const LUNCH = 9;

// The positions a Bell Schedule times, in the order its setup lists them.
export const TIMED_POSITIONS = [1, 2, 3, 4, 5, 6, BREAK, LUNCH] as const;

export type BellTime = { starts: string; ends: string };

export type BellSchedule = {
	id: string;
	name: string;
	isDefault: boolean;
	times: Record<number, BellTime>;
};

// What a page needs to time its rows: the Bell Schedules, and which one each Class follows.
export type Bell = {
	schedules: BellSchedule[];
	classSchedules: Record<string, string>;
};

// One row of a day. A Break or Lunch row stands for every Bell Schedule whose Break or Lunch has
// these times, so a Break shared by the whole school is one row; `scheduleId` is the one a click
// on the row takes, the default when it is among them. Every other row has no Bell Schedule.
export type DayRow = {
	position: number;
	scheduleId: string | null;
	scheduleIds: string[];
	label: string;
	times: BellTime | null;
};

const untimed = (position: number, label: string): DayRow => ({
	position,
	scheduleId: null,
	scheduleIds: [],
	label,
	times: null
});

export function defaultSchedule(schedules: readonly BellSchedule[]) {
	return schedules.find((s) => s.isDefault) ?? null;
}

// Before school, the timed rows by start time, After school. The Periods take the default Bell
// Schedule's times; each Break and Lunch sits at its own. With no Bell Schedule the day is the
// six Periods between the two untimed bands, exactly as before ADR-0033.
export function dayRows(schedules: readonly BellSchedule[]): DayRow[] {
	const fallback = defaultSchedule(schedules);
	const periods = [1, 2, 3, 4, 5, 6].map((p) => ({
		...untimed(p, `P${p}`),
		times: fallback?.times[p] ?? null
	}));
	if (!fallback) return [untimed(0, 'Before school'), ...periods, untimed(7, 'After school')];

	const intervals = [BREAK, LUNCH].flatMap((position) => {
		const groups = new Map<string, BellSchedule[]>();
		for (const s of schedules) {
			const t = s.times[position];
			const key = `${t.starts}-${t.ends}`;
			groups.set(key, [...(groups.get(key) ?? []), s]);
		}
		const word = position === BREAK ? 'Break' : 'Lunch';
		return [...groups.values()].map((group): DayRow => ({
			position,
			scheduleId: (group.find((s) => s.isDefault) ?? group[0]).id,
			scheduleIds: group.map((s) => s.id),
			label: groups.size === 1 ? word : `${word} (${group.map((s) => s.name).join(', ')})`,
			times: group[0].times[position]
		}));
	});
	const timed = [...periods, ...intervals].sort(
		(a, b) =>
			a.times!.starts.localeCompare(b.times!.starts) || a.times!.ends.localeCompare(b.times!.ends)
	);
	return [untimed(0, 'Before school'), ...timed, untimed(7, 'After school')];
}

// The row an Event Slot sits in: its position, and for Break or Lunch its Bell Schedule's row.
export function rowIndexOf(
	rows: readonly DayRow[],
	position: number,
	scheduleId: string | null
): number {
	return rows.findIndex(
		(r) =>
			r.position === position && (r.scheduleIds.length === 0 || r.scheduleIds.includes(scheduleId!))
	);
}

// The Bell Schedule a Class follows, or the default when no Class is asked about. Null when no
// Bell Schedule is set up.
export function scheduleOf(bell: Bell, classId?: string | null): BellSchedule | null {
	const id = classId ? bell.classSchedules[classId] : undefined;
	return bell.schedules.find((s) => s.id === id) ?? defaultSchedule(bell.schedules);
}

// The clock times of Periods `from` to `to` for one Class, or for the default Bell Schedule when
// no Class holds them: from the first one's start to the last one's end. Null when no Bell
// Schedule is set up.
export function periodTimes(
	bell: Bell,
	{ from, to = from, classId }: { from: number; to?: number; classId?: string | null }
): BellTime | null {
	const schedule = scheduleOf(bell, classId);
	if (!schedule) return null;
	return { starts: schedule.times[from].starts, ends: schedule.times[to].ends };
}

export const timesLabel = (t: BellTime) => `${t.starts}–${t.ends}`;
