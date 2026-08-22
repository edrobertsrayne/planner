// PROTOTYPE — throwaway. Serves fixtures only — see fixtures.ts for why. This loader deliberately
// does not import `$lib/server/db`: the prototype must render on an empty database, and a route
// that reads no real data is a route with nothing to leak.
import { agendaFixture, mondayOf, weekFixture } from './fixtures';
import type { PageServerLoad } from './$types';

function today() {
	return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, n: number): string {
	const d = new Date(iso + 'T00:00:00Z');
	d.setUTCDate(d.getUTCDate() + n);
	return d.toISOString().slice(0, 10);
}

export const load: PageServerLoad = ({ url }) => {
	const t = today();
	const thisWeek = mondayOf(t);
	const nextWeek = addDays(thisWeek, 7);

	const requested = url.searchParams.get('week');
	const selected = requested === nextWeek ? nextWeek : thisWeek;
	const letter = selected === thisWeek ? 'A' : 'B';

	return {
		today: t,
		rows: agendaFixture(t),
		week: weekFixture(selected, letter),
		prev: selected === nextWeek ? thisWeek : null,
		next: selected === thisWeek ? nextWeek : null
	};
};
