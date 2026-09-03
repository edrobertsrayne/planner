// PROTOTYPE for issue #228 — throwaway. Answers "what do the two doors look like", not "does
// Placement work": a Placement is faked in memory only, keyed by (classId, date, period), so the
// Calendar day menu, the Calendar tile and the Session panel all read the same fake state while
// the tab stays open. Nothing here calls the server. Delete this file when #228 is resolved and
// its answer has been folded into the real code.

interface FakePlacement {
	title: string;
}

const placements = $state<Record<string, FakePlacement>>({});

function key(classId: string, date: string, period: number) {
	return `${classId}|${date}|${period}`;
}

export function placeFake(classId: string, date: string, period: number, title: string) {
	placements[key(classId, date, period)] = { title };
}

export function removeFake(classId: string, date: string, period: number) {
	delete placements[key(classId, date, period)];
}

export function fakePlacementFor(
	classId: string,
	date: string,
	period: number
): FakePlacement | null {
	return placements[key(classId, date, period)] ?? null;
}
