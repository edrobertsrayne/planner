import { fail } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import type { Actions } from './$types';

const MIN_PASSWORD_LENGTH = 12;

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
				// The forgotten session on a school machine is the reason to change a password at all;
				// leaving it alive would make the change do nothing about the thing it was for.
				body: { currentPassword, newPassword, revokeOtherSessions: true },
				headers: event.request.headers
			});
		} catch (error) {
			if (error instanceof APIError) return fail(400, { error: 'Current password is incorrect.' });
			throw error;
		}

		return { success: true };
	}
};
