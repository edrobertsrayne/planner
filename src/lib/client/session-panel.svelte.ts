// Where the open Session lives: in the URL, as ?session=<classId>~<date>~<period> — linkable,
// reload-stable, and closed by Back rather than by leaving the screen (issue #88). An occasion —
// Class, date, Period — identifies it, never a Session row id (ADR-0002).
//
// These are goto() writes rather than pushState/replaceState: those deliberately leave page.url
// alone (sveltejs/kit#11492), and the layout derives the open Session from it. goto() re-runs the
// reading view's load — its url dependency changed — which costs one refresh of the screen sitting
// behind the panel and buys a single source of truth.
import { goto } from '$app/navigation';
import { page } from '$app/state';

export interface Occasion {
	classId: string;
	date: string;
	period: number;
}

export const SESSION_PARAM = 'session';

export function encodeOccasion(occasion: Occasion): string {
	return `${occasion.classId}~${occasion.date}~${occasion.period}`;
}

export function decodeOccasion(raw: string | null): Occasion | null {
	if (!raw) return null;
	const parts = raw.split('~');
	if (parts.length !== 3) return null;
	const [classId, date, period] = parts;
	const n = Number(period);
	// `Number('')` is 0, so the empty-part checks come first, on the strings themselves.
	if (!classId || !date || !period || !Number.isInteger(n)) return null;
	return { classId, date, period: n };
}

// The occasion the running URL carries, or null when no Session is open.
export function selectedOccasion(): Occasion | null {
	return decodeOccasion(page.url.searchParams.get(SESSION_PARAM));
}

function urlWith(occasion: Occasion | null): string {
	const url = new URL(page.url.href);
	if (occasion) url.searchParams.set(SESSION_PARAM, encodeOccasion(occasion));
	else url.searchParams.delete(SESSION_PARAM);
	return `${url.pathname}${url.search}`;
}

// Opening pushes a history entry, so Back lands on the Session-less page and closes the panel
// instead of changing screen; switching and closing replace, so exactly one extra entry exists
// however many Sessions are stepped through, and Back always closes in a single press.
export function openSession(occasion: Occasion): void {
	const alreadyOpen = selectedOccasion() !== null;
	void goto(urlWith(occasion), {
		replaceState: alreadyOpen,
		noScroll: true,
		keepFocus: true
	});
}

export function closeSession(): void {
	void goto(urlWith(null), { replaceState: true, noScroll: true, keepFocus: true });
}
