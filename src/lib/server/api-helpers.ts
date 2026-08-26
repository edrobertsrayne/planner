import { json } from '@sveltejs/kit';

const ALLOWED_STATUSES = new Set(['draft', 'planned']);

export function validateString(
	value: unknown,
	name: string,
	maxLength: number
): string | Response {
	if (typeof value !== 'string') {
		return json({ error: `The "${name}" field must be a string.` }, { status: 400 });
	}
	const trimmed = value.trim();
	if (trimmed.length === 0) {
		return json({ error: `The "${name}" field must not be empty.` }, { status: 400 });
	}
	if (trimmed.length > maxLength) {
		return json({ error: `The "${name}" field must be at most ${maxLength} characters.` }, { status: 400 });
	}
	return trimmed;
}

export function validateStatus(value: unknown): 'draft' | 'planned' | Response {
	if (value === undefined) return 'draft';
	if (typeof value !== 'string' || !ALLOWED_STATUSES.has(value)) {
		return json({ error: 'The "status" field must be "draft" or "planned".' }, { status: 400 });
	}
	return value as 'draft' | 'planned';
}

export function validateLength(value: unknown): number | Response {
	if (value === undefined) return 1;
	if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 20) {
		return json({ error: 'The "length" field must be an integer between 1 and 20.' }, { status: 400 });
	}
	return value;
}

export function rejectUnknownFields(body: Record<string, unknown>, allowed: Set<string>): Response | null {
	for (const key of Object.keys(body)) {
		if (!allowed.has(key)) {
			return json({ error: `The field "${key}" is not recognised.` }, { status: 400 });
		}
	}
	return null;
}

export function getDateToday(): string {
	const now = new Date();
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}