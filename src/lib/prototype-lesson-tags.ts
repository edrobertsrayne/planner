// PROTOTYPE ONLY (issue #233) — Tag doesn't exist in the schema yet, so tags here are
// deterministically faked, purely to judge how a tag renders on a Calendar tile against the
// Class Tone the tile already carries. Drop this whole file, its imports, and the variant
// markup in the Calendar's +page.svelte once a variant wins.
//
// Same generator as the Courses-list (issue #214) and Agenda / Session-panel (issue #232)
// prototypes, so all three agree on which fake Lessons carry which tags. A Calendar cell's
// `lesson` is a LessonName — title and topicName, no id — so the seed is the title here.

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
