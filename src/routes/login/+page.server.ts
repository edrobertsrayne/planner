import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import type { Actions } from './$types';
import { safeRedirectTarget } from './safe-redirect';

export const actions: Actions = {
	default: async (event) => {
		const data = await event.request.formData();
		const email = String(data.get('email') ?? '');
		const password = String(data.get('password') ?? '');

		try {
			// sveltekitCookies replays the Set-Cookie header this produces through event.cookies.
			await auth.api.signInEmail({
				body: { email, password },
				headers: event.request.headers
			});
		} catch (error) {
			if (error instanceof APIError)
				return fail(400, { email, error: 'Incorrect email or password.' });
			throw error;
		}

		redirect(303, safeRedirectTarget(event.url.searchParams.get('redirectTo')));
	}
};
