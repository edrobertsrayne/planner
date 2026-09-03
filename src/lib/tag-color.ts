// A Tag's colour is derived from its name at render time, nothing stored (issue #244's
// Implementation Decisions, "Rendering"). Folded in from the reference implementation on
// prototype/lesson-tags-agenda-session (`protoTagColor`), where three read-screen variants were
// judged against it.

function hashOf(s: string): number {
	let hash = 0;
	for (const ch of s) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
	return hash;
}

export function tagColor(name: string): { bg: string; fg: string } {
	const hue = hashOf(name) % 360;
	return {
		bg: `hsl(${hue} 70% 94%)`,
		fg: `hsl(${hue} 55% 32%)`
	};
}
