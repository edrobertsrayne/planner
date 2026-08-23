// A stable Tone per Class for the Calendar (issue #36), hashed from the id rather than stored —
// there is no tone field on Class yet. Hashing keeps a Class's Tone from shifting whenever another
// Class is created or deleted, which a plain array index would not.
//
// The eight slots are the tone tokens defined in src/routes/layout.css (`--tone-{0-7}-{bg|fg|ring}`,
// issue #83): slot 0 indigo, then emerald, sky, violet, amber, rose, teal, fuchsia — the old
// palette's order with stone replaced by indigo. Handing back var() references rather than Tailwind
// utilities takes this file out of the palette business entirely; consumers style with them inline,
// so both theme variants come free from the .dark override in layout.css.
const SLOTS = 8;

export function classTone(classId: string) {
	let hash = 0;
	for (let i = 0; i < classId.length; i++) hash = (hash * 31 + classId.charCodeAt(i)) >>> 0;
	const slot = hash % SLOTS;
	return {
		bg: `var(--tone-${slot}-bg)`,
		fg: `var(--tone-${slot}-fg)`,
		ring: `var(--tone-${slot}-ring)`
	};
}
