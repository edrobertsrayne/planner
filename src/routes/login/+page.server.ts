import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import { signInThrottle } from '$lib/server/login-throttle';
import type { Actions } from './$types';
import { safeRedirectTarget } from './safe-redirect';

export const actions: Actions = {
	default: async (event) => {
		const data = await event.request.formData();
		const email = String(data.get('email') ?? '');
		const password = String(data.get('password') ?? '');

		// Checked before the password is tested, so a refused attempt never runs a hash and the
		// lock cannot be used as a CPU lever either (ADR-0011).
		if (signInThrottle.locked())
			return fail(429, {
				email,
				error: 'Too many failed sign-ins. Wait a minute and try again.'
			});

		try {
			// sveltekitCookies replays the Set-Cookie header this produces through event.cookies.
			await auth.api.signInEmail({
				body: { email, password },
				headers: event.request.headers
			});
		} catch (error) {
			if (error instanceof APIError) {
				signInThrottle.failed();
				return fail(400, { email, error: 'Incorrect email or password.' });
			}
			throw error;
		}

		signInThrottle.signedIn();
		redirect(303, safeRedirectTarget(event.url.searchParams.get('redirectTo'), event.url.origin));
	}
};
