// PROTOTYPE ONLY (issue #305): picks the app-shell variant and finds the next Session for the
// variants that offer a "Next Session" shortcut. Leaves with the prototype.
import { today } from '$lib/date';
import { db } from '$lib/server/db/client';
import { agenda } from '$lib/server/planner';
import type { LayoutServerLoad } from './$types';

const SHELLS = ['A', 'B', 'C', 'D'];

export const load: LayoutServerLoad = ({ url, cookies }) => {
	// `?shell=` wins and is remembered in a cookie, so the real tabs keep the variant.
	const asked = url.searchParams.get('shell');
	if (asked && SHELLS.includes(asked)) {
		cookies.set('prototype-shell', asked, { path: '/', httpOnly: false });
	}
	const shell = asked && SHELLS.includes(asked) ? asked : (cookies.get('prototype-shell') ?? 'A');

	const next = agenda(db, { today: today(), horizonDays: 14 }).rows[0] ?? null;

	return {
		shell,
		nextSession: next && {
			classId: next.classId,
			classLabel: next.classLabel,
			date: next.date,
			period: next.periodFrom,
			lessonTitle: next.lesson?.title ?? null
		}
	};
};
