/**
 * A demo database for prototypes, screenshots and manual smoke tests. Not for the e2e suite: that
 * writes its own data with `reset` in scripts/e2e-fixtures.ts.
 *
 *   bun scripts/demo-db.ts seed /tmp/demo.db
 *   DATABASE_URL=/tmp/demo.db bun run dev --port 5173 --strictPort
 *   bun scripts/demo-db.ts user http://localhost:5173
 *
 * `seed` writes through the planner seam, as the app does, into a fresh file. The Terms cover the
 * academic year that holds today. Scheduling is derived from two weeks ago, so the record holds
 * taught Sessions and the queue runs on into the future.
 *
 * `user` posts the first-run wizard on the running server. /setup is the one path that creates the
 * user (ADR-0011), so the demo login is made the same way as a real one. The credentials are the
 * e2e suite's, from e2e/helpers.ts.
 */
import { existsSync } from 'node:fs';
import { and, desc, eq, lt } from 'drizzle-orm';
import { openDatabase, runMigrations } from '../src/lib/server/db/index.ts';
import * as schema from '../src/lib/server/db/schema.ts';
import {
	addSlot,
	assignTopic,
	createClass,
	createCourse,
	createLesson,
	createLink,
	createTopic,
	replaceTerms,
	writeSessionNote
} from '../src/lib/server/planner/index.ts';
import { today } from '../src/lib/date.ts';
import { EMAIL, PASSWORD } from '../e2e/helpers.ts';

function seed(path: string | undefined) {
	if (!path) throw new Error('Usage: demo-db.ts seed <path>');
	if (existsSync(path)) throw new Error(`${path} exists. The seed writes a fresh file only.`);

	const { client, db } = openDatabase(path);
	runMigrations(client);

	const now = today();
	const since = plusDays(now, -14);
	replaceTerms(db, client, { terms: termsOf(now), today: since });

	const science = createCourse(db, { name: 'Year 9 Science' });
	const forces = createTopic(db, { courseId: science.id, name: 'Forces' });
	const reactions = createTopic(db, { courseId: science.id, name: 'Chemical reactions' });
	const physics = createCourse(db, { name: 'Year 11 Physics' });
	const electricity = createTopic(db, { courseId: physics.id, name: 'Electricity' });

	for (const [topicId, lessons] of [
		[forces.id, FORCES],
		[reactions.id, REACTIONS],
		[electricity.id, ELECTRICITY]
	] as const) {
		for (const { links, ...lesson } of lessons) {
			const created = createLesson(db, { topicId, ...lesson, status: 'planned', today: since });
			for (const link of links ?? []) createLink(db, { lessonId: created.lesson.id, ...link });
		}
	}

	// The same shape as the unit fixture: a Thursday double, and Periods across both Weeks.
	const classes = [
		{ label: '9B/Sc1', courseId: science.id, topics: [forces.id, reactions.id] },
		{ label: '9C/Sc2', courseId: science.id, topics: [forces.id] },
		{ label: '11A/Ph1', courseId: physics.id, topics: [electricity.id] }
	];
	const slots: Record<string, Array<['A' | 'B', number, number]>> = {
		'9B/Sc1': [
			['A', 1, 3],
			['A', 3, 1],
			['A', 4, 5],
			['A', 4, 6],
			['B', 2, 2],
			['B', 5, 4]
		],
		'9C/Sc2': [
			['A', 2, 1],
			['B', 1, 4],
			['B', 4, 2]
		],
		'11A/Ph1': [
			['A', 5, 2],
			['B', 3, 3],
			['B', 3, 4]
		]
	};
	const created = new Map<string, string>();
	for (const { label, courseId, topics } of classes) {
		const cls = createClass(db, { label, courseId });
		created.set(label, cls.id);
		for (const [week, day, period] of slots[label]) {
			addSlot(db, { classId: cls.id, week, day, period });
		}
		for (const topicId of topics) assignTopic(db, { classId: cls.id, topicId, today: since });
	}

	// One note on the last taught Session, for the Session page and the Class page "Last taught".
	const classId = created.get('9B/Sc1')!;
	const [last] = db
		.select()
		.from(schema.session)
		.where(and(eq(schema.session.classId, classId), lt(schema.session.date, now)))
		.orderBy(desc(schema.session.date), desc(schema.session.period))
		.limit(1)
		.all();
	if (last) {
		writeSessionNote(db, {
			classId,
			date: last.date,
			period: last.period,
			note: 'Ran out of time for the plenary. Recap $F = ma$ next lesson.'
		});
	}

	client.close();
	console.log(`Seeded ${path}. Start the server, then run: bun scripts/demo-db.ts user <origin>`);
}

async function createUser(origin: string | undefined) {
	if (!origin) throw new Error('Usage: demo-db.ts user <origin>');
	const body = new URLSearchParams({
		name: 'Demo Teacher',
		email: EMAIL,
		password: PASSWORD,
		confirmPassword: PASSWORD
	});
	// SvelteKit refuses a form POST whose Origin is not its own. Asked for JSON, the action answers
	// with its result, `{ type: 'redirect', location }`, rather than a 303.
	const response = await fetch(`${origin}/setup`, {
		method: 'POST',
		body,
		headers: { origin, accept: 'application/json' }
	});
	const result = (await response.json()) as { type: string; location?: string };
	if (result.location === '/') console.log(`Created ${EMAIL} / ${PASSWORD}`);
	else if (result.location === '/login') console.log('A user exists already.');
	else throw new Error(`/setup answered ${response.status}: ${JSON.stringify(result)}`);
}

// Representative Term dates for the academic year that holds `date`. It starts in September; a
// date in August belongs to the year that starts that month.
function termsOf(date: string) {
	const month = Number(date.slice(5, 7));
	const y = Number(date.slice(0, 4)) - (month < 8 ? 1 : 0);
	const n = y + 1;
	return [
		{ opens: `${y}-09-03`, closes: `${y}-10-23` },
		{ opens: `${y}-11-02`, closes: `${y}-12-18` },
		{ opens: `${n}-01-05`, closes: `${n}-02-12` },
		{ opens: `${n}-02-22`, closes: `${n}-03-26` },
		{ opens: `${n}-04-12`, closes: `${n}-05-28` },
		{ opens: `${n}-06-07`, closes: `${n}-07-21` }
	];
}

function plusDays(iso: string, days: number): string {
	const d = new Date(`${iso}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}

type DemoLesson = {
	title: string;
	body?: string;
	length?: number;
	links?: Array<{ url: string; label: string }>;
};

const FORCES: DemoLesson[] = [
	{
		title: 'Contact and non-contact forces',
		body: '## Objectives\n\n- Name **contact** and **non-contact** forces.\n- Draw force arrows to scale.\n\n## Starter\n\nSort the cards into two groups.',
		links: [{ url: 'https://www.bbc.co.uk/bitesize/topics/zsxxsbk', label: 'Bitesize: forces' }]
	},
	{
		title: 'Resultant forces',
		body: '## Objectives\n\n- Add forces along a line.\n- Say when an object is in equilibrium.\n\n> Two equal and opposite forces give a resultant of $0\\,\\text{N}$.'
	},
	{
		title: 'Speed',
		body: '## Objectives\n\n- Use $v = \\dfrac{s}{t}$.\n- Convert km/h to m/s.\n\n## Kit\n\n- Light gates: \\$10 deposit each.'
	},
	{
		title: "Newton's second law",
		length: 2,
		body: "## Objectives\n\n- Recall Newton's second law, $F = ma$, and rearrange for $a$.\n- Use $v = u + at$ to find the final speed.\n\n## Equations\n\n$$\ns = ut + \\tfrac{1}{2}at^2\n$$\n\n## Practical\n\nTrolley down a ramp. Record $t$ for five masses.",
		links: [
			{
				url: 'https://phet.colorado.edu/en/simulations/forces-and-motion-basics',
				label: 'PhET: forces and motion'
			}
		]
	},
	{ title: 'Momentum', body: '- $p = mv$\n- Conservation of momentum in collisions.' },
	{ title: 'Stopping distances', length: 2 },
	{ title: 'Pressure in fluids', body: '$$\np = h \\rho g\n$$' },
	{ title: 'Forces assessment' }
];

const REACTIONS: DemoLesson[] = [
	{
		title: 'Combustion',
		body: '## Objectives\n\n- Write the word equation for combustion.\n- Balance the symbol equation.\n\n$$\n\\ce{2H2 + O2 -> 2H2O}\n$$'
	},
	{
		title: 'Acids and alkalis',
		body: '- $\\ce{HCl + NaOH -> NaCl + H2O}$\n- pH scale from 0 to 14.'
	},
	{ title: 'Neutralisation practical', length: 2 },
	{ title: 'Rates of reaction', body: 'Rate $= \\dfrac{\\text{amount of product}}{\\text{time}}$' },
	{ title: 'Thermal decomposition', body: '$$\n\\ce{CaCO3 ->[heat] CaO + CO2}\n$$' },
	{ title: 'Reactions assessment' }
];

const ELECTRICITY: DemoLesson[] = [
	{ title: 'Charge and current', body: '- $Q = It$\n- Current in series and parallel.' },
	{
		title: 'Potential difference and resistance',
		body: '## Objectives\n\n- Use $V = IR$.\n\n$$\nR_{\\text{total}} = R_1 + R_2\n$$'
	},
	{ title: 'I–V characteristics', length: 2 },
	{ title: 'Power', body: '$$\nP = IV = I^2 R\n$$' },
	{ title: 'Mains electricity' },
	{ title: 'Electricity assessment' }
];

const [command, arg] = process.argv.slice(2);

if (command === 'seed') seed(arg);
else if (command === 'user') await createUser(arg);
else throw new Error('Usage: demo-db.ts seed <path> | user <origin>');
