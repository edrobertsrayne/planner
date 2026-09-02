// PROTOTYPE ONLY (issue #232) — Tag doesn't exist in the schema yet, so tags here are
// deterministically faked from the Lesson id, purely to judge the Agenda / Session-panel
// rendering against an existing Class Tone and Ready tick. Drop this whole file, its imports,
// and the variant markup in +page.svelte / session-body.svelte once a variant wins.
//
// Mirrors the fake-tag generator from the Courses-list prototype (issue #214, branch
// prototype/lesson-tags-courses-list) so the two prototypes agree on which fake Lessons carry
// which tags.

const PROTO_TAGS = ['Practical', 'Demonstration', 'Trip', 'Assessment'];

function hashOf(s: string): number {
	let hash = 0;
	for (const ch of s) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
	return hash;
}

export function protoTagsFor(lessonId: string): string[] {
	const hash = hashOf(lessonId);
	const count = hash % 3; // 0, 1 or 2 tags — most Lessons stay untagged
	const picked = Array.from(
		{ length: count },
		(_, i) => PROTO_TAGS[(hash >>> (i + 2)) % PROTO_TAGS.length]
	);
	return picked.filter((tag, i) => picked.indexOf(tag) === i);
}

// Same idea as issue #214's colour: computed at render time from the tag's name, nothing stored.
export function protoTagColor(tag: string): { bg: string; fg: string } {
	const hash = hashOf(tag);
	const hue = hash % 360;
	return {
		bg: `hsl(${hue} 70% 94%)`,
		fg: `hsl(${hue} 55% 32%)`
	};
}
