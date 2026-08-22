// PROTOTYPE — throwaway. The occasion in the URL, so the route and sheet variants can be
// linkable and reload-stable the way the aside variant can't. `classId~date~period` — no
// thought given to prettiness; the question is whether URL-carried selection feels right at
// all, not what the final path looks like.
import type { Occasion } from '$lib/client/session-panel.svelte';

export const PARAM = 'session';

export function encodeOccasion(o: Occasion): string {
	return `${o.classId}~${o.date}~${o.period}`;
}

export function decodeOccasion(raw: string | null): Occasion | null {
	if (!raw) return null;
	const [classId, date, period] = raw.split('~');
	if (!classId || !date || !Number.isFinite(Number(period))) return null;
	return { classId, date, period: Number(period) };
}
