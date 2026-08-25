// The two things every form action does before it can call the seam: read a field, and turn a
// refusal from the seam into a 400 the page can show.
import { fail } from '@sveltejs/kit';

export function trimmed(data: FormData, field: string): string {
	return String(data.get(field) ?? '').trim();
}

// The seam refuses a write by throwing with the reason already written for Ed — "This Topic has
// already been taught and cannot be unassigned." — so the message is passed straight through.
// `fallback` covers anything that was not thrown deliberately.
export function badRequest(error: unknown, fallback: string) {
	return fail(400, { error: error instanceof Error ? error.message : fallback });
}
