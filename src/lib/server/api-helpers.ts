import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { SQLiteTable, SQLiteColumn } from 'drizzle-orm/sqlite-core';
import type { Db } from './planner/derive';

const ALLOWED_STATUSES = new Set(['draft', 'planned']);

// The name/title/label ceiling every API route enforces (issue #129, §6 of the planning API spec).
export const MAX_NAME_LENGTH = 200;

// The note ceiling a Blocked Day's note is measured against — its own limit, not the name's.
export const MAX_NOTE_LENGTH = 200;

// Every route needs its target row to exist before it reads or writes further. Returns the 404
// Response to return as-is, or null once the row is confirmed present.
export function requireExisting<T extends SQLiteTable & { id: SQLiteColumn }>(
	db: Db,
	table: T,
	id: string,
	notFoundMessage: string
): Response | null {
	const [existing] = db.select({ id: table.id }).from(table).where(eq(table.id, id)).all();
	return existing ? null : json({ error: notFoundMessage }, { status: 404 });
}

export function validateString(value: unknown, name: string, maxLength: number): string | Response {
	if (typeof value !== 'string') {
		return json({ error: `The "${name}" field must be a string.` }, { status: 400 });
	}
	const trimmed = value.trim();
	if (trimmed.length === 0) {
		return json({ error: `The "${name}" field must not be empty.` }, { status: 400 });
	}
	if (trimmed.length > maxLength) {
		return json(
			{ error: `The "${name}" field must be at most ${maxLength} characters.` },
			{ status: 400 }
		);
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
		return json(
			{ error: 'The "length" field must be an integer between 1 and 20.' },
			{ status: 400 }
		);
	}
	return value;
}

export function rejectUnknownFields(
	body: Record<string, unknown>,
	allowed: Set<string>
): Response | null {
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

export function validateUrl(value: unknown): string | Response {
	if (typeof value !== 'string') {
		return json({ error: 'The "url" field must be a string.' }, { status: 400 });
	}
	const trimmed = value.trim();
	if (trimmed.length === 0 || trimmed.length > 2000) {
		return json({ error: 'The "url" field must be 1 to 2000 characters.' }, { status: 400 });
	}
	try {
		const url = new URL(trimmed);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') {
			return json({ error: 'The "url" field must be an http: or https: URL.' }, { status: 400 });
		}
	} catch {
		return json({ error: 'The "url" field must be a valid URL.' }, { status: 400 });
	}
	return trimmed;
}
