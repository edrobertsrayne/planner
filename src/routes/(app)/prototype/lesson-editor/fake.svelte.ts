// PROTOTYPE ONLY (issue #304) — in-memory fake data for the Lesson editor layout prototype.
// Nothing here reaches the server. Edits live until reload.
import { toast } from 'svelte-sonner';

export type FakeLesson = {
	id: string;
	title: string;
	body: string;
	status: 'draft' | 'planned';
	length: number;
	topicId: string;
	links: { id: string; label: string; url: string }[];
	attachments: { id: string; filename: string; size: number }[];
	tags: string[];
};

export const course = { id: 'c1', name: 'GCSE Physics (AQA Combined Science Trilogy)' };

export const topics = [
	{ id: 't1', name: 'Energy' },
	{ id: 't2', name: 'Waves' },
	{
		id: 't3',
		name: "Forces and motion — Newton's laws, momentum, stopping distances and terminal velocity"
	},
	{ id: 't4', name: 'Electricity' }
];

export const taughtBy = ['10X1 Physics', '10Y2 Physics'];

export const existingTagNames = ['Required practical', 'Assessment', 'Homework', 'Demo', 'Recap'];

const REFRACTION_BODY = `## Objectives

- Describe what happens to light as it crosses a boundary between two materials.
- Explain refraction in terms of a change of **wave speed**.
- Draw ray diagrams with the normal, the angle of incidence and the angle of refraction.

## Set up

- Ray boxes, 12 V supplies and slit plates — one per pair (prep room, shelf C).
- Glass blocks, protractors, A3 plain paper.
- Blackout blinds in S4 stick: close them **before** the class arrives.

## Starter (10 min)

Pencil in a glass of water on each bench. *What do you notice? Why might that happen?*

## Main

1. Demo: ray box through a glass block, normal drawn on the board.
2. Pairs trace the incident and emergent rays for three angles.
3. Measure *i* and *r*; record in the table on the worksheet.
4. Wavefront diagram: the "marching soldiers" analogy for the change of speed.

> Last time: two groups forgot to draw the normal before they measured. Model it first.

## Plenary

Exit ticket — three questions on the slide. Collect and sort into **got it / nearly / not yet**.

## Homework

Seneca: *Refraction* assignment, due next lesson.

## Notes for next year

- The worksheet table needs a column for the angle of the emergent ray.
- 10Y2 needed an extra 15 minutes on the ray diagrams.`;

function lesson(n: number, title: string, extra: Partial<FakeLesson> = {}): FakeLesson {
	return {
		id: `l${n}`,
		title,
		body: '',
		status: 'draft',
		length: 1,
		topicId: 't2',
		links: [],
		attachments: [],
		tags: [],
		...extra
	};
}

export const lessons: FakeLesson[] = $state([
	lesson(1, 'Transverse and longitudinal waves', { status: 'planned', tags: ['Recap'] }),
	lesson(2, 'Properties of waves', { status: 'planned' }),
	lesson(3, 'Required practical: ripple tank', {
		status: 'planned',
		length: 2,
		tags: ['Required practical']
	}),
	lesson(4, 'Reflection', { status: 'planned' }),
	lesson(5, 'Refraction', {
		body: REFRACTION_BODY,
		length: 2,
		links: [
			{
				id: 'k1',
				label: 'Slides — Refraction',
				url: 'https://onedrive.example.com/refraction.pptx'
			},
			{
				id: 'k2',
				label: 'PhET: Bending Light',
				url: 'https://phet.colorado.edu/en/simulations/bending-light'
			},
			{ id: 'k3', label: 'Seneca assignment', url: 'https://app.senecalearning.com/classroom/abc' },
			{
				id: 'k4',
				label: 'BBC Bitesize — Refraction of light',
				url: 'https://www.bbc.co.uk/bitesize/guides/zw42ng8'
			}
		],
		attachments: [
			{ id: 'a1', filename: 'Refraction worksheet v3.docx', size: 184_320 },
			{ id: 'a2', filename: 'Exit ticket — refraction.pdf', size: 92_160 }
		],
		tags: ['Required practical', 'Demo', 'Homework']
	}),
	lesson(6, 'Required practical: refraction through a glass block', {
		length: 2,
		tags: ['Required practical']
	}),
	lesson(7, 'The electromagnetic spectrum'),
	lesson(8, 'Uses and dangers of EM waves'),
	lesson(9, 'Radio waves and electrical circuits'),
	lesson(10, 'Infrared: required practical (Leslie cube)', { tags: ['Required practical'] }),
	lesson(11, 'Emission and absorption of radiation'),
	lesson(12, 'Lenses (separate science only)'),
	lesson(13, 'Visible light and colour'),
	lesson(14, 'Revision'),
	lesson(15, 'End of Topic test', { tags: ['Assessment'] })
]);

export function fakeAction(what: string) {
	toast.info(`Prototype: this would ${what}.`);
}

export function formatSize(bytes: number) {
	return bytes >= 1024 * 1024
		? `${(bytes / 1024 / 1024).toFixed(1)} MB`
		: `${Math.round(bytes / 1024)} KB`;
}

export function hostOf(url: string) {
	return (url.match(/^[a-z]+:\/\/([^/]+)/i)?.[1] ?? url).replace(/^www\./, '');
}
