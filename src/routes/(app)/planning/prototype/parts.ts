// PROTOTYPE ONLY (issue #307): small helpers the variants share.
import { addDays, formatDayMonth, weekday } from '$lib/date';
import { TODAY, type Entry } from './store.svelte';

const monday = (iso: string) => addDays(iso, -((weekday(iso) + 6) % 7));

// Groups the stream into teaching weeks, then "Not scheduled". Keeps the stream's order.
export function byWeek(rows: Entry[]) {
	const thisWeek = monday(TODAY);
	const groups: { key: string; label: string; rows: Entry[] }[] = [];
	for (const r of rows) {
		const m = r.occurrence ? monday(r.occurrence.date) : 'none';
		let g = groups.at(-1);
		if (!g || g.key !== m) {
			const label =
				m === 'none'
					? 'Not scheduled'
					: m === thisWeek
						? 'This week'
						: m === addDays(thisWeek, 7)
							? 'Next week'
							: `Week of ${formatDayMonth(m)}`;
			g = { key: m, label, rows: [] };
			groups.push(g);
		}
		g.rows.push(r);
	}
	return groups;
}

export function when(days: number) {
	if (days <= 0) return 'today';
	if (days === 1) return 'tomorrow';
	return `in ${days} days`;
}
