// PROTOTYPE — throwaway. Eight Classes, one per tone index, so every swatch has a real label on it.
export const CLASSES = [
	{ label: '7A/Sc1', subject: 'Science', topic: 'Particles', next: 'States of matter' },
	{ label: '8C/Ma2', subject: 'Maths', topic: 'Ratio', next: 'Direct proportion' },
	{ label: '9B/Ph1', subject: 'Physics', topic: 'Forces', next: 'Hooke’s law' },
	{ label: '10A/Ch1', subject: 'Chemistry', topic: 'Bonding', next: 'Ionic lattices' },
	{ label: '11D/Bi2', subject: 'Biology', topic: 'Homeostasis', next: 'The kidney' },
	{ label: '12/Ph', subject: 'Physics', topic: 'Mechanics', next: 'Projectiles' },
	{ label: '13/Ch', subject: 'Chemistry', topic: 'Kinetics', next: 'Rate equations' },
	{ label: '9E/Sc3', subject: 'Science', topic: 'Waves', next: 'Refraction' }
];

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

// A fortnight-ish week of the Teaching Week grid: [period][day] -> tone index or null (free).
export const WEEK: (number | null)[][] = [
	[0, 3, 1, 6, 2],
	[4, 0, 5, 2, 7],
	[null, 6, 3, 1, 0],
	[2, 5, null, 4, 3],
	[7, 1, 4, 0, null]
];
