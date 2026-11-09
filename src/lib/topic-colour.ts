// A steady Tone per Topic, so interleaved Topics read apart at a glance: the Topic's id picks one
// of the eight Calm Tone dots, and `strength` is how much of it shows, so a tint over the card and
// a solid dot are the same colour. Translucent, so the text keeps the theme's own colour in light
// and dark alike. A Standalone Lesson has no Topic: the neutral outline.
export function topicColour(topicId: string | null, strength = 0.22): string {
	const percent = Math.round(strength * 100);
	if (!topicId) return `color-mix(in oklab, var(--outline) ${percent}%, transparent)`;
	let n = 0;
	for (const c of topicId) n = (n * 31 + c.charCodeAt(0)) % 8;
	return `color-mix(in oklab, var(--tone-${n}-dot) ${percent}%, transparent)`;
}
