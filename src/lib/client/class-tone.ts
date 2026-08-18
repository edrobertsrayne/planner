// A stable colour per Class for the Calendar (issue #36), hashed from the id rather than stored —
// there is no colour field on Class. Hashing keeps a Class's colour from shifting whenever another
// Class is created or deleted, which a plain array index would not. Written as a literal palette
// of full class names, not template-built strings, so Tailwind's scanner sees them.
const PALETTE = [
	{ bg: 'bg-stone-100', text: 'text-stone-800', border: 'border-stone-400' },
	{ bg: 'bg-emerald-100', text: 'text-emerald-900', border: 'border-emerald-400' },
	{ bg: 'bg-sky-100', text: 'text-sky-900', border: 'border-sky-400' },
	{ bg: 'bg-violet-100', text: 'text-violet-900', border: 'border-violet-400' },
	{ bg: 'bg-amber-100', text: 'text-amber-900', border: 'border-amber-400' },
	{ bg: 'bg-rose-100', text: 'text-rose-900', border: 'border-rose-400' },
	{ bg: 'bg-teal-100', text: 'text-teal-900', border: 'border-teal-400' },
	{ bg: 'bg-fuchsia-100', text: 'text-fuchsia-900', border: 'border-fuchsia-400' }
] as const;

export function classTone(classId: string) {
	let hash = 0;
	for (let i = 0; i < classId.length; i++) hash = (hash * 31 + classId.charCodeAt(i)) >>> 0;
	return PALETTE[hash % PALETTE.length];
}
