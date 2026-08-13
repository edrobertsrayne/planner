// PROTOTYPE — throwaway. Answers issue #6: what do the agenda and week views show?
// In-memory only. No database, no persistence. Delete this whole directory when #6 closes.
//
// Built on Ed's real CAST autumn 2026 calendar (see issue #3), with a plausible
// invented timetable and Course content. "Today" is Tue 24 Nov 2026, Week B — the
// week that loses Thu 26 + Fri 27 Nov to INSET, so Blocked Days, Blocked Slots,
// Continuations and shift-right are all visible at once.

export const TODAY = '2026-11-24';

// ---------------------------------------------------------------- the calendar

export const TERMS = [
	{ name: 'Autumn 1', start: '2026-09-03', end: '2026-10-23' },
	{ name: 'Autumn 2', start: '2026-11-02', end: '2026-12-18' }
];

/** Blocked Day: nobody is taught, cause not recorded. */
export const BLOCKED_DAYS: Record<string, string> = {
	'2026-11-26': 'INSET',
	'2026-11-27': 'INSET'
};

/** Blocked Slot: one Class, one Slot, one date — carries free text. */
export const BLOCKED_SLOTS = [
	{ classId: '11C', date: '2026-11-16', period: 5, note: 'Y11 mocks — hall' },
	{ classId: '9B', date: '2026-11-19', period: 3, note: 'Fire drill (whole school)' },
	{ classId: '12A', date: '2026-11-25', period: 6, note: 'Diamond Light Source trip' },
	{ classId: '13A', date: '2026-12-04', period: 1, note: 'UCAS interviews — cover set' }
];

export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
export const PERIODS = [1, 2, 3, 4, 5, 6];

// ------------------------------------------------------------------ date utils

export function addDays(iso: string, n: number): string {
	const d = new Date(iso + 'T00:00:00Z');
	d.setUTCDate(d.getUTCDate() + n);
	return d.toISOString().slice(0, 10);
}

/** 1 = Monday … 7 = Sunday */
export function weekday(iso: string): number {
	const d = new Date(iso + 'T00:00:00Z').getUTCDay();
	return d === 0 ? 7 : d;
}

export function mondayOf(iso: string): string {
	return addDays(iso, 1 - weekday(iso));
}

export function termOf(iso: string) {
	return TERMS.find((t) => iso >= t.start && iso <= t.end) ?? null;
}

export function isTeachingDate(iso: string): boolean {
	return weekday(iso) <= 5 && termOf(iso) !== null && !BLOCKED_DAYS[iso];
}

/** In a Term and a weekday, but possibly a Blocked Day. */
function isTermWeekday(iso: string): boolean {
	return weekday(iso) <= 5 && termOf(iso) !== null;
}

export function fmtDay(iso: string): string {
	return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		timeZone: 'UTC'
	});
}

export function fmtLongDay(iso: string): string {
	return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		timeZone: 'UTC'
	});
}

// -------------------------------------------------------- Teaching Weeks (A/B)
// The letter alternates across Teaching Weeks — weeks wholly inside a break take
// no turn. Generated once here; in the real app it is stored, not computed.

export type TeachingWeek = { monday: string; letter: 'A' | 'B'; term: string };

export const TEACHING_WEEKS: TeachingWeek[] = (() => {
	const out: TeachingWeek[] = [];
	let monday = mondayOf(TERMS[0].start);
	const last = mondayOf(TERMS[TERMS.length - 1].end);
	let letter: 'A' | 'B' = 'A';
	while (monday <= last) {
		const days = [0, 1, 2, 3, 4].map((i) => addDays(monday, i));
		const taught = days.filter(isTermWeekday);
		if (taught.length > 0) {
			out.push({ monday, letter, term: termOf(taught[0])!.name });
			letter = letter === 'A' ? 'B' : 'A';
		}
		monday = addDays(monday, 7);
	}
	return out;
})();

export function weekLetterOf(iso: string): 'A' | 'B' | null {
	return TEACHING_WEEKS.find((w) => w.monday === mondayOf(iso))?.letter ?? null;
}

// -------------------------------------------------------------- Classes & Slots

export type ClassRow = {
	id: string;
	label: string;
	course: string;
	/** tailwind colour family used consistently across all three variants */
	tone: string;
};

export const CLASSES: ClassRow[] = [
	{ id: '8D', label: '8D/Sc3', course: 'Year 8 Science', tone: 'stone' },
	{ id: '9B', label: '9B/Sc1', course: 'Year 9 Physics', tone: 'emerald' },
	{ id: '10A', label: '10A/Sc2', course: 'GCSE Physics Y10', tone: 'sky' },
	{ id: '11C', label: '11C/Sc1', course: 'GCSE Physics Y11', tone: 'violet' },
	{ id: '12A', label: '12A/Ph1', course: 'A-level Physics Y12', tone: 'amber' },
	{ id: '13A', label: '13A/Ph1', course: 'A-level Physics Y13', tone: 'rose' }
];

export const classById = (id: string) => CLASSES.find((c) => c.id === id)!;

/** A Slot is (Week, Day, Period) → Class. 42 of them across the fortnight. */
export type Slot = { week: 'A' | 'B'; day: number; period: number; classId: string };

const T = (week: 'A' | 'B', day: number, rows: (string | null)[]): Slot[] =>
	rows
		.map((classId, i) => ({ week, day, period: i + 1, classId: classId! }))
		.filter((s) => s.classId);

export const TIMETABLE: Slot[] = [
	// Week A                 P1     P2     P3     P4     P5     P6
	...T('A', 1, /* Mon */ ['9B', '12A', '12A', null, '11C', null]),
	...T('A', 2, /* Tue */ ['13A', '13A', '10A', '9B', null, null]),
	...T('A', 3, /* Wed */ [null, '11C', '8D', '12A', '10A', null]),
	...T('A', 4, /* Thu */ ['13A', null, '9B', '11C', '12A', '10A']),
	...T('A', 5, /* Fri */ ['8D', '10A', '13A', null, '12A', null]),
	// Week B
	...T('B', 1, /* Mon */ ['10A', null, '9B', '13A', '12A', '11C']),
	...T('B', 2, /* Tue */ ['12A', '8D', null, '10A', '13A', '11C']),
	...T('B', 3, /* Wed */ ['11C', '9B', '13A', null, null, '12A']),
	...T('B', 4, /* Thu */ [null, '10A', '12A', '11C', null, '9B']),
	...T('B', 5, /* Fri */ ['13A', null, '8D', null, '12A', null])
];

export function slotAt(letter: 'A' | 'B', day: number, period: number): Slot | undefined {
	return TIMETABLE.find((s) => s.week === letter && s.day === day && s.period === period);
}

// ------------------------------------------------------------ Course content
// Topics in order, Lessons in order. Real titles where the autumn actually
// reaches; `n` alone for topics beyond the horizon, filled with placeholders.

type TopicSpec = { name: string; titles?: string[]; n?: number; long?: number[] };

const COURSES: Record<string, TopicSpec[]> = {
	'8D': [
		{
			name: 'Health and Lifestyle',
			titles: [
				'Nutrients and a balanced diet',
				'Testing foods for starch and sugar',
				'Digestion and enzymes',
				'Drugs, alcohol and the body',
				'Smoking and the lungs',
				'Breathing and gas exchange',
				'Health and lifestyle review',
				'Health and lifestyle assessment'
			]
		},
		{
			name: 'The Periodic Table',
			titles: [
				'Metals and non-metals',
				'Groups and periods',
				'Group 1: the alkali metals',
				'Reactions of the alkali metals',
				'Group 7: the halogens',
				'Displacement reactions',
				'Group 0: the noble gases',
				'Patterns and predictions',
				'Periodic table review',
				'Periodic table assessment'
			]
		},
		{
			name: 'Electricity and Magnetism',
			titles: [
				'Static electricity',
				'Building simple circuits',
				'Current and its measurement',
				'Potential difference',
				'Series and parallel',
				'Magnets and magnetic fields',
				'Electromagnets',
				'Electricity and magnetism assessment'
			]
		},
		{ name: 'Motion and Pressure', n: 8 },
		{ name: 'Adaptation and Inheritance', n: 8 }
	],
	'9B': [
		{
			name: 'Forces',
			titles: [
				'What forces do',
				'Contact and non-contact forces',
				'Measuring forces with a newtonmeter',
				'Mass and weight',
				'Force diagrams',
				'Resultant forces',
				'Balanced and unbalanced',
				'Friction',
				'Investigating friction',
				'Drag and terminal velocity',
				'Springs and Hooke’s law',
				'Required practical: extension of a spring',
				'Analysing the spring results',
				'Moments and levers',
				'Pressure in solids',
				'Pressure in fluids',
				'Floating and sinking',
				'Forces review',
				'Forces assessment',
				'Forces assessment feedback'
			],
			long: [11]
		},
		{
			name: 'Energy',
			titles: [
				'Energy stores',
				'Energy transfers and pathways',
				'Sankey diagrams',
				'Conservation of energy',
				'Work done',
				'Calculating kinetic energy',
				'Gravitational potential energy',
				'Power',
				'Efficiency',
				'Improving efficiency in the home',
				'Conduction, convection and radiation',
				'Required practical: insulating a beaker',
				'Analysing the insulation results',
				'Energy resources',
				'Renewables and non-renewables',
				'The National Grid',
				'Energy review',
				'Energy assessment',
				'Energy assessment feedback'
			],
			long: [11]
		},
		{
			name: 'Electricity',
			titles: [
				'Charge and current',
				'Building and drawing circuits',
				'Measuring current',
				'Potential difference',
				'Resistance',
				'Required practical: resistance of a wire',
				'Analysing the resistance results',
				'Series circuits',
				'Parallel circuits',
				'Comparing series and parallel',
				'Power in circuits',
				'Mains electricity and safety',
				'Electricity review',
				'Electricity assessment'
			]
		},
		{ name: 'Waves', n: 14 },
		{ name: 'Space', n: 10 }
	],
	'10A': [
		{
			name: 'Energy Stores and Transfers',
			titles: [
				'Energy stores and systems',
				'Changes in energy: kinetic',
				'Changes in energy: elastic and gravitational',
				'Specific heat capacity',
				'Required practical: specific heat capacity',
				'Analysing the SHC results',
				'Power',
				'Energy transfers and efficiency',
				'Reducing unwanted transfers',
				'Required practical: thermal insulation',
				'Analysing the insulation results',
				'National and global energy resources',
				'Renewables and the future mix',
				'Energy assessment'
			]
		},
		{
			name: 'Electric Circuits',
			titles: [
				'Circuit symbols and diagrams',
				'Charge flow and current',
				'Current, resistance and p.d.',
				'Required practical: resistance of a wire',
				'Analysing the resistance results',
				'Resistors and I–V characteristics',
				'Required practical: I–V characteristics',
				'The filament lamp and the diode',
				'Thermistors and LDRs',
				'Sensing circuits',
				'Series circuits',
				'Parallel circuits',
				'Circuit calculations',
				'Circuits review',
				'Circuits assessment',
				'Circuits assessment feedback'
			],
			long: [3, 6]
		},
		{
			name: 'Mains Electricity and Power',
			titles: [
				'Direct and alternating potential difference',
				'Mains electricity and the three-core cable',
				'Energy transfers in appliances',
				'The National Grid',
				'Power calculations',
				'Static charge',
				'Electric fields',
				'Mains electricity assessment'
			]
		},
		{ name: 'Particle Model of Matter', n: 10 },
		{ name: 'Atomic Structure', n: 12 },
		{ name: 'Forces in Balance', n: 14 }
	],
	'11C': [
		{
			name: 'Forces and Motion',
			titles: [
				'Scalars and vectors',
				'Contact and non-contact forces',
				'Resultant forces and free-body diagrams',
				'Work done and energy transfer',
				'Forces and elasticity',
				'Required practical: force and extension',
				'Analysing the extension results',
				'Distance, displacement, speed and velocity',
				'Distance–time graphs',
				'Acceleration',
				'Velocity–time graphs',
				'Terminal velocity',
				'Newton’s first and second laws',
				'Required practical: force, mass and acceleration',
				'Newton’s third law',
				'Stopping distances',
				'Reaction time and braking',
				'Momentum',
				'Conservation of momentum',
				'Forces review',
				'Forces assessment',
				'Forces assessment feedback'
			],
			long: [13]
		},
		{
			name: 'Waves',
			titles: [
				'Transverse and longitudinal waves',
				'Wave properties and the wave equation',
				'Required practical: waves in a ripple tank',
				'Reflection and refraction',
				'Required practical: refraction through a glass block',
				'Required practical: infrared radiation',
				'Sound waves and hearing',
				'Ultrasound and echo sounding',
				'Seismic waves and the Earth’s structure',
				'The electromagnetic spectrum',
				'Uses and hazards of EM waves',
				'Lenses and ray diagrams',
				'Black body radiation',
				'Waves review',
				'Waves assessment',
				'Waves assessment feedback'
			]
		},
		{ name: 'Magnetism and Induction', n: 12 },
		{ name: 'Space Physics', n: 8 },
		{ name: 'Revision and Exam Practice', n: 22 }
	],
	'12A': [
		{
			name: 'Measurements and Errors',
			titles: [
				'SI units and prefixes',
				'Estimation and orders of magnitude',
				'Uncertainty and error',
				'Combining uncertainties',
				'Graphs and error bars',
				'Measurement skills assessment'
			]
		},
		{
			name: 'Particles and Radiation',
			titles: [
				'Inside the atom',
				'Isotopes and nuclide notation',
				'The strong nuclear force',
				'Alpha and beta decay',
				'Antiparticles',
				'Photons and the electronvolt',
				'Annihilation and pair production',
				'The four fundamental interactions',
				'Feynman diagrams',
				'Classification of particles',
				'Quarks and antiquarks',
				'Conservation laws in particle physics',
				'Particles review',
				'Particles assessment',
				'Particles assessment feedback'
			]
		},
		{
			name: 'Waves and Optics',
			titles: [
				'Progressive waves',
				'Longitudinal and transverse waves',
				'Polarisation',
				'Superposition and interference',
				'Stationary waves',
				'Required practical: stationary waves on a string',
				'Analysing the stationary wave results',
				'Path difference and coherence',
				'Young’s double slit experiment',
				'Required practical: Young’s double slit',
				'Diffraction gratings',
				'Refraction and Snell’s law',
				'Total internal reflection',
				'Optical fibres',
				'Waves review',
				'Waves assessment'
			],
			long: [5, 9]
		},
		{
			name: 'Mechanics',
			titles: [
				'Scalars and vectors revisited',
				'Resolving vectors',
				'Moments and couples',
				'Centre of mass',
				'Equations of motion',
				'Free fall and g',
				'Required practical: determination of g',
				'Analysing the g results',
				'Projectile motion',
				'Newton’s laws of motion',
				'Friction and drag',
				'Terminal speed',
				'Momentum and impulse',
				'Collisions',
				'Work, energy and power',
				'Conservation of energy',
				'Mechanics review',
				'Mechanics assessment'
			]
		},
		{ name: 'Materials', n: 12 },
		{ name: 'Electricity', n: 18 }
	],
	'13A': [
		{
			name: 'Further Mechanics',
			titles: [
				'Circular motion: angular speed',
				'Centripetal acceleration',
				'Centripetal force in practice',
				'Simple harmonic motion',
				'SHM graphs and equations',
				'The simple pendulum',
				'Required practical: SHM of a mass–spring system',
				'Analysing the SHM results',
				'Energy in SHM',
				'Free and forced vibrations',
				'Resonance and damping',
				'Further mechanics review',
				'Further mechanics assessment'
			]
		},
		{
			name: 'Thermal Physics',
			titles: [
				'Internal energy and temperature',
				'Specific heat capacity',
				'Specific latent heat',
				'Required practical: specific heat capacity of a solid',
				'Analysing the calorimetry results',
				'The gas laws',
				'Required practical: Boyle’s law',
				'The ideal gas equation',
				'The kinetic theory model',
				'Deriving the kinetic theory equation',
				'Thermal physics review',
				'Thermal physics assessment'
			],
			long: [3]
		},
		{
			name: 'Fields',
			titles: [
				'Gravitational fields',
				'Newton’s law of gravitation',
				'Gravitational field strength',
				'Gravitational potential',
				'Orbits and satellites',
				'Geostationary orbits',
				'Fields review 1',
				'Electric fields',
				'Coulomb’s law',
				'Electric field strength',
				'Electric potential',
				'Comparing gravitational and electric fields',
				'Capacitance',
				'Energy stored by a capacitor',
				'Charging and discharging',
				'Required practical: capacitor discharge',
				'Time constants',
				'Fields review 2',
				'Fields assessment'
			]
		},
		{ name: 'Nuclear Physics', n: 16 },
		{ name: 'Turning Points in Physics', n: 18 }
	]
};

export type Lesson = {
	title: string;
	topic: string;
	topicIndex: number;
	/** 0-based position in the flattened Course */
	index: number;
	length: number;
	body?: string;
	links?: { url: string; label: string }[];
};

export type Topic = { name: string; index: number; lessons: Lesson[] };

function buildCourse(classId: string): Topic[] {
	const specs = COURSES[classId];
	let index = 0;
	return specs.map((spec, topicIndex) => {
		const titles =
			spec.titles ?? Array.from({ length: spec.n ?? 10 }, (_, i) => `${spec.name} ${i + 1}`);
		const lessons = titles.map((title, i) => ({
			title,
			topic: spec.name,
			topicIndex,
			index: index++,
			length: spec.long?.includes(i) ? 2 : 1
		}));
		return { name: spec.name, index: topicIndex, lessons };
	});
}

export const COURSE_BY_CLASS: Record<string, Topic[]> = Object.fromEntries(
	CLASSES.map((c) => [c.id, buildCourse(c.id)])
);

export const flatLessons = (classId: string): Lesson[] =>
	COURSE_BY_CLASS[classId].flatMap((t) => t.lessons);

// A few Lessons carry a body and links — enough to see where they'd surface.
{
	const decorate = (classId: string, title: string, body: string, links: [string, string][]) => {
		const l = flatLessons(classId).find((x) => x.title === title);
		if (l) {
			l.body = body;
			l.links = links.map(([label, url]) => ({ label, url }));
		}
	};
	decorate(
		'9B',
		'Efficiency',
		'**Objective:** calculate efficiency as a ratio and a percentage.\n\nStarter: Sankey diagram from last lesson on the board — ask for the wasted branch before defining anything.\n\nWatch for: dividing the wrong way round. Insist on useful ÷ total every single time.',
		[
			['Efficiency slides', 'https://onedrive.live.com/?id=A1B2C3D4%21512'],
			['Worksheet (differentiated)', 'https://onedrive.live.com/?id=A1B2C3D4%21518']
		]
	);
	decorate(
		'12A',
		'Young’s double slit experiment',
		'**Objective:** derive and apply w = λD/s.\n\nDark room booked. Green laser only — no pointing, sign the risk assessment sheet before they touch it.\n\nCommon error: measuring to the first bright fringe rather than across ten and dividing.',
		[
			['Double slit slides', 'https://onedrive.live.com/?id=A1B2C3D4%21901'],
			['Risk assessment', 'https://onedrive.live.com/?id=A1B2C3D4%21903']
		]
	);
	decorate(
		'11C',
		'Newton’s first and second laws',
		'**Objective:** state both laws and apply F = ma.\n\nTrolley and ramp kit is already out from last week. Six sets, so pairs.',
		[['Forces booklet pp. 14–19', 'https://onedrive.live.com/?id=A1B2C3D4%21221']]
	);
	decorate(
		'13A',
		'Deriving the kinetic theory equation',
		'**Objective:** follow and reproduce the derivation of pV = ⅓Nm(c²).\n\nThis is the one they find hardest all year. Do it twice: once fast for the shape, once slowly for the algebra.',
		[['Derivation handout', 'https://onedrive.live.com/?id=A1B2C3D4%21740']]
	);
	decorate(
		'10A',
		'Required practical: I–V characteristics',
		'**Objective:** RP4 — obtain I–V characteristics for a resistor, filament lamp and diode.\n\nPower packs on 12 V max. Check the diodes are the right way round before they switch on — three died last year.',
		[
			['RP4 method sheet', 'https://onedrive.live.com/?id=A1B2C3D4%21455'],
			['Results template', 'https://onedrive.live.com/?id=A1B2C3D4%21457']
		]
	);
}

// -------------------------------------------------------------- Continuations
// A Session marked as needing more time: its Lesson also takes the next
// Available Slot for that Class. Keyed by classId|date|period.

export const CONTINUATIONS = new Set([
	'12A|2026-11-23|5', // spills into Tue P1 — visible in today's agenda
	'10A|2026-11-23|1', // spills into Tue P4
	'8D|2026-11-24|2', // 8D's next slot is Fri, an INSET day — spills all the way to Wed 2 Dec
	'9B|2026-11-11|2',
	'13A|2026-11-17|1',
	'11C|2026-11-30|5' // a future one, so the week view has to show it too
]);

// ---------------------------------------------------------- Session-level notes
// Notes belong to the occasion (Class, date, Period), never to the Lesson.

export const SESSION_NOTES: Record<string, string> = {
	'9B|2026-11-20|3':
		'Got through the Sankey diagrams much faster than expected. Whole class fine on the arithmetic; it is the labelling they lose marks on.',
	'9B|2026-11-23|3':
		'Cover work left — I was at the Y11 parents evening. Set the efficiency worksheet.',
	'12A|2026-11-23|5':
		'Only got as far as setting up the string and signal generator. Nobody took a reading. Continuing next lesson.',
	'10A|2026-11-23|1':
		'Two power packs dead, so half the class watched. Needs redoing properly with the full kit.',
	'11C|2026-11-19|4':
		'Stopping distances went well — the reaction-time ruler drop is worth keeping. Rushed the braking-distance graph at the end.',
	'13A|2026-11-23|4':
		'Very quiet group today, three out at the UCAS talk. Recap the derivation before moving on.',
	'8D|2026-11-20|3':
		'Static electricity — the van de Graaff was a hit but it ate the whole lesson.',
	'8D|2026-11-24|2':
		'Half of them still cannot tell me the difference between current and p.d. Not moving on until they can — needs another period.',
	'12A|2026-11-20|5':
		'Polarisation. Good discussion on the sunglasses demo; slides need a diagram of the filters.',
	'9B|2026-11-18|2':
		'Power calculations. Set the extension questions for homework — collect Friday.'
};

// ----------------------------------------------------------- the scheduling zip
// A miniature of the engine proven in issue #4: walk the ordered stream of
// Available Slots and zip the owed Lesson-parts onto it. Shift-right is what
// falls out — there is no move operation here.

export type Session = {
	classId: string;
	date: string;
	period: number;
	lesson: Lesson;
	/** which period of a multi-period Lesson this is, 1-based */
	part: number;
	partsTotal: number;
	/** this Session was marked as needing more time */
	continues: boolean;
	/** this Session exists because the previous one was marked as needing more time */
	continuedFrom: boolean;
	note?: string;
};

const key = (classId: string, date: string, period: number) => `${classId}|${date}|${period}`;

/** Ordered Available Slots for a Class, from a date onwards. */
export function availableSlots(classId: string, from: string, to: string) {
	const out: { date: string; period: number }[] = [];
	for (let d = from; d <= to; d = addDays(d, 1)) {
		if (!isTeachingDate(d)) continue;
		const letter = weekLetterOf(d);
		if (!letter) continue;
		for (const period of PERIODS) {
			const slot = slotAt(letter, weekday(d), period);
			if (!slot || slot.classId !== classId) continue;
			if (BLOCKED_SLOTS.some((b) => b.classId === classId && b.date === d && b.period === period))
				continue;
			out.push({ date: d, period });
		}
	}
	return out;
}

function scheduleClass(classId: string): Session[] {
	const lessons = flatLessons(classId);
	// A Lesson of Planned Length n owes n parts. It takes the next n Available
	// Slots in order, which may run across two days.
	const parts = lessons.flatMap((lesson) =>
		Array.from({ length: lesson.length }, (_, i) => ({ lesson, part: i + 1 }))
	);
	const stream = availableSlots(classId, TERMS[0].start, TERMS[TERMS.length - 1].end);

	const out: Session[] = [];
	let i = 0;
	let carried = false;
	for (const slot of stream) {
		const p = parts[i];
		if (!p) break; // Course outran the year
		const k = key(classId, slot.date, slot.period);
		const continues = CONTINUATIONS.has(k);
		out.push({
			classId,
			date: slot.date,
			period: slot.period,
			lesson: p.lesson,
			part: p.part,
			partsTotal: p.lesson.length,
			continues,
			continuedFrom: carried,
			note: SESSION_NOTES[k]
		});
		if (continues) {
			carried = true; // the same Lesson takes the next slot too
		} else {
			carried = false;
			i++;
		}
	}
	return out;
}

export const SESSIONS: Session[] = CLASSES.flatMap((c) => scheduleClass(c.id));

export const sessionsOn = (date: string) =>
	SESSIONS.filter((s) => s.date === date).sort((a, b) => a.period - b.period);

export const sessionAt = (date: string, period: number) =>
	SESSIONS.find((s) => s.date === date && s.period === period);

export const sessionsFrom = (from: string, days: number) =>
	SESSIONS.filter((s) => s.date >= from && s.date < addDays(from, days)).sort(
		(a, b) => a.date.localeCompare(b.date) || a.period - b.period
	);

export const blockedSlotAt = (date: string, period: number) =>
	BLOCKED_SLOTS.find((b) => b.date === date && b.period === period);

/** How far through its Course a Class is, as of a date. */
export function courseProgress(classId: string, asOf: string) {
	const taught = SESSIONS.filter((s) => s.classId === classId && s.date < asOf);
	const last = taught[taught.length - 1];
	const topics = COURSE_BY_CLASS[classId];
	const total = flatLessons(classId).length;
	const done = last ? last.lesson.index + (last.continues ? 0 : 1) : 0;
	return {
		lessonsDone: done,
		lessonsTotal: total,
		topics,
		currentTopic: last ? topics[last.lesson.topicIndex] : topics[0],
		lastTaught: last
	};
}

/** Days in the week containing `date`, Monday–Friday. */
export function weekOf(date: string) {
	const monday = mondayOf(date);
	const letter = weekLetterOf(date);
	return {
		monday,
		letter,
		term: termOf(date)?.name ?? termOf(monday)?.name ?? null,
		days: [0, 1, 2, 3, 4].map((i) => {
			const d = addDays(monday, i);
			return { date: d, blocked: BLOCKED_DAYS[d] ?? null, inTerm: termOf(d) !== null };
		})
	};
}

/** Colour classes per Class, written out so Tailwind keeps them. */
export const TONE: Record<
	string,
	{ bg: string; text: string; border: string; dot: string; soft: string }
> = {
	stone: {
		bg: 'bg-stone-100',
		text: 'text-stone-800',
		border: 'border-stone-300',
		dot: 'bg-stone-500',
		soft: 'bg-stone-50'
	},
	emerald: {
		bg: 'bg-emerald-100',
		text: 'text-emerald-900',
		border: 'border-emerald-300',
		dot: 'bg-emerald-600',
		soft: 'bg-emerald-50'
	},
	sky: {
		bg: 'bg-sky-100',
		text: 'text-sky-900',
		border: 'border-sky-300',
		dot: 'bg-sky-600',
		soft: 'bg-sky-50'
	},
	violet: {
		bg: 'bg-violet-100',
		text: 'text-violet-900',
		border: 'border-violet-300',
		dot: 'bg-violet-600',
		soft: 'bg-violet-50'
	},
	amber: {
		bg: 'bg-amber-100',
		text: 'text-amber-900',
		border: 'border-amber-300',
		dot: 'bg-amber-600',
		soft: 'bg-amber-50'
	},
	rose: {
		bg: 'bg-rose-100',
		text: 'text-rose-900',
		border: 'border-rose-300',
		dot: 'bg-rose-600',
		soft: 'bg-rose-50'
	}
};

export const toneOf = (classId: string) => TONE[classById(classId).tone];
