// PROTOTYPE ONLY (issue #311): fake Session detail on top of the Agenda prototype's rows. Notes,
// Continuations, Placements and removals are local and lost on reload. Leaves with the prototype.
import { addDays } from '$lib/date';
import {
	TODAY,
	notes,
	rowByKey,
	sessionParam,
	set,
	type Row
} from '../prototype-agenda/store.svelte';

export type Link = { label: string; url: string };
export type Attachment = { name: string; size: string };
export type Detail = {
	row: Row;
	plan: string;
	links: Link[];
	attachments: Attachment[];
	// Started: today or earlier. A Session that has started is where a note gets written.
	started: boolean;
	placed: boolean;
	canPlace: boolean;
	continued: boolean;
};

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

function planFor(title: string, h: number) {
	if (h % 5 === 0) return '';
	return `## Starter (5 min)
Three questions on the board from last lesson. Cold-call two answers.

## Main
- Introduce **${title.toLowerCase()}** with the demo at the front bench.
- Worked example on the board, then students try the two on the sheet.
- Pairs: the card sort. Circulate; pick out one good answer to share.
${h % 3 === 0 ? '- Practical: groups of three, method on slide 6. Goggles on.\n' : ''}
## Plenary
Exit ticket: one thing you can now explain, one question you still have.

> Watch the time on the main task — last year it ran over.`;
}

const LINKS: Link[] = [
	{ label: 'Slides (Google Drive)', url: 'https://drive.google.com/' },
	{ label: 'PhET simulation', url: 'https://phet.colorado.edu/' },
	{ label: 'Seneca homework', url: 'https://senecalearning.com/' }
];
const FILES: Attachment[] = [
	{ name: 'worksheet.pdf', size: '240 KB' },
	{ name: 'card-sort.docx', size: '88 KB' },
	{ name: 'exit-ticket.pdf', size: '31 KB' }
];

// Local state the panel writes.
const continued: Record<string, boolean> = $state({});
const placedTitle: Record<string, string> = $state({});
const removed: Record<string, boolean> = $state({});

export function detailOf(row: Row | null): Detail | null {
	if (!row) return null;
	const h = hash(row.key);
	const placedHere = placedTitle[row.key];
	const standalone = row.lesson?.id === 'standalone-careers';
	// A placed Lesson here wins; a removed Placement leaves an Open Slot.
	const lesson = placedHere
		? { id: `placed-${row.key}`, title: placedHere, topicName: null, courseName: null, tags: [] }
		: standalone && removed[row.key]
			? null
			: row.lesson;
	const placed = !!placedHere || (standalone && !removed[row.key]);
	return {
		row: { ...row, lesson },
		plan: lesson ? (placedHere ? '' : planFor(lesson.title, h)) : '',
		links: lesson && !placedHere ? LINKS.slice(0, h % 3) : [],
		attachments: lesson && !placedHere ? FILES.slice(0, (h >> 2) % 3) : [],
		started: row.date <= TODAY,
		placed,
		canPlace: row.date >= TODAY && !placed,
		continued: !!continued[row.key]
	};
}

export const openDetail = () => detailOf(rowByKey(sessionParam()));
export const close = () => set({ session: null });
export const toggleContinuation = (d: Detail) => (continued[d.row.key] = !continued[d.row.key]);
export const place = (d: Detail, title: string) => (placedTitle[d.row.key] = title);
export function removePlacement(d: Detail) {
	if (placedTitle[d.row.key]) delete placedTitle[d.row.key];
	else removed[d.row.key] = true;
}

// Some Sessions in the look-back already have a note to read.
const SAMPLE = [
	'Ran out of time on the card sort. **Pick it up next lesson.**\n\n- Sam and Priya absent\n- Board pen dead — bring a spare',
	'Went well. Practical worked first time; groups finished early.',
	'Lively. Moved Jack to the front. Homework set on Seneca.'
];
let n = 0;
for (let d = addDays(TODAY, -7); d < TODAY; d = addDays(d, 1)) {
	for (const key of ['c10x', 'c11p', 'c12p', 'c9a'].map((c) => `${c}-${d}`)) {
		for (const p of [1, 2, 3, 4, 5]) {
			const k = `${key}-${p}`;
			if (rowByKey(k) && n++ % 3 !== 2) notes[k] = SAMPLE[n % SAMPLE.length];
		}
	}
}
