import { fail, redirect } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { createSingleUser, hasUser } from '$lib/server/setup';
import type { Actions } from './$types';

const MIN_PASSWORD_LENGTH = 12;

export const actions: Actions = {
	default: async (event) => {
		const data = await event.request.formData();
		const email = String(data.get('email') ?? '').trim();
		const name = String(data.get('name') ?? '').trim();
		const password = String(data.get('password') ?? '');
		const confirmPassword = String(data.get('confirmPassword') ?? '');
		const entered = { email, name };

		if (!email || !name) return fail(400, { ...entered, error: 'Name and email are required.' });
		if (password.length < MIN_PASSWORD_LENGTH) {
			return fail(400, {
				...entered,
				error: `Choose a password of at least ${MIN_PASSWORD_LENGTH} characters.`
			});
		}
		if (password !== confirmPassword) {
			return fail(400, { ...entered, error: 'The two passwords do not match.' });
		}

		// hooks.server.ts has already checked this for the GET; checking again here is what makes it
		// true at the moment of writing. Two simultaneous submissions lose to `user.email` UNIQUE.
		if (await hasUser()) redirect(303, '/login');

		try {
			await createSingleUser({ email, password, name });
		} catch {
			// The only plausible failure is the UNIQUE constraint, i.e. someone got there first.
			redirect(303, '/login');
		}

		// sveltekitCookies replays the Set-Cookie through event.cookies, so the wizard finishes signed
		// in — the first thing a new install shows should be the app, not another form.
		await auth.api.signInEmail({ body: { email, password }, headers: event.request.headers });

		redirect(303, '/');
	}
};
