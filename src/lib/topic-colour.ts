// A steady tint per Topic, so interleaved Topics read apart at a glance. Translucent, so the text
// keeps the theme's own colour in light and dark alike. A Standalone Lesson has no Topic: grey.
export function topicColour(topicId: string | null, strength = 0.22): string {
	if (!topicId) return `hsl(0 0% 50% / ${strength})`;
	let hue = 0;
	for (const c of topicId) hue = (hue * 31 + c.charCodeAt(0)) % 360;
	return `hsl(${hue} 75% 55% / ${strength})`;
}
