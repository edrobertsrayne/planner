import { fail } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db/client';
import { apiKey } from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

const MIN_PASSWORD_LENGTH = 12;

// The token is minted in one place, this file: the load mints the standing key when the database
// has none, and the regenerate action mints its replacement. Both mint the same shape.
function mintToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return 'pln_' + Buffer.from(bytes).toString('base64url');
}

export const load: PageServerLoad = async () => {
	const columns = {
		token: apiKey.token,
		createdAt: apiKey.createdAt,
		lastUsedAt: apiKey.lastUsedAt
	};

	const [key] = await db.select(columns).from(apiKey).limit(1);
	if (key) return { key };

	const [minted] = await db.insert(apiKey).values({ token: mintToken() }).returning(columns);
	return { key: minted };
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

	regenerateKey: async () => {
		await db.delete(apiKey);
		await db.insert(apiKey).values({ token: mintToken() });

		return {};
	}
};
