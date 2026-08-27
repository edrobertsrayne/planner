import { fail } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db/client';
import { apiKey } from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

const MIN_PASSWORD_LENGTH = 12;

async function hashToken(token: string): Promise<string> {
	const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
	return Array.from(new Uint8Array(hashBuffer))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

export const load: PageServerLoad = async () => {
	const [key] = await db
		.select({
			createdAt: apiKey.createdAt,
			lastUsedAt: apiKey.lastUsedAt
		})
		.from(apiKey)
		.limit(1);

	return { key: key ?? null };
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

	generateKey: async () => {
		const bytes = crypto.getRandomValues(new Uint8Array(32));
		const token = 'pln_' + Buffer.from(bytes).toString('base64url');
		const hash = await hashToken(token);

		await db.delete(apiKey);
		await db.insert(apiKey).values({ hash });

		return { token };
	}
};
