import { fail } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db/client';
import { apiKey } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

const MIN_PASSWORD_LENGTH = 12;

async function hashToken(token: string): Promise<string> {
	const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
	return Array.from(new Uint8Array(hashBuffer))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

export const load: PageServerLoad = async () => {
	const keys = await db
		.select({
			id: apiKey.id,
			name: apiKey.name,
			createdAt: apiKey.createdAt,
			lastUsedAt: apiKey.lastUsedAt
		})
		.from(apiKey)
		.orderBy(apiKey.createdAt);

	return { keys };
};

export const actions: Actions = {
	changePassword: async (event) => {
		const data = await event.request.formData();
		const currentPassword = String(data.get('currentPassword') ?? '');
		const newPassword = String(data.get('newPassword') ?? '');
		const confirmPassword = String(data.get('confirmPassword') ?? '');

		if (newPassword.length < MIN_PASSWORD_LENGTH) {
			return fail(400, {
				error: `Choose a password of at least ${MIN_PASSWORD_LENGTH} characters.`
			});
		}
		if (newPassword !== confirmPassword) {
			return fail(400, { error: 'The two passwords do not match.' });
		}

		try {
			await auth.api.changePassword({
				body: { currentPassword, newPassword, revokeOtherSessions: true },
				headers: event.request.headers
			});
		} catch (error) {
			if (error instanceof APIError) return fail(400, { error: 'Current password is incorrect.' });
			throw error;
		}

		return { success: true };
	},

	createKey: async (event) => {
		const data = await event.request.formData();
		const name = String(data.get('name') ?? '').trim();

		if (!name) return fail(400, { error: 'Give the key a name.' });

		const bytes = crypto.getRandomValues(new Uint8Array(32));
		const token = 'pln_' + Buffer.from(bytes).toString('base64url');
		const hash = await hashToken(token);

		try {
			await db.insert(apiKey).values({ name, hash }).returning();
		} catch {
			return fail(400, { error: 'A key with that name already exists.' });
		}

		return { token, name };
	},

	revokeKey: async (event) => {
		const data = await event.request.formData();
		const id = String(data.get('id') ?? '');

		if (!id) return fail(400, { error: 'No key specified.' });

		const result = await db
			.delete(apiKey)
			.where(and(eq(apiKey.id, id)))
			.returning({ id: apiKey.id });

		if (result.length === 0) return fail(404, { error: 'Key not found.' });

		return { success: true };
	}
};
