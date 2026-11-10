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

		// Each attempt takes its turn and a locked one is refused before the password is tested, so
		// neither a burst of guesses nor the lock itself can be used as a CPU lever (ADR-0011).
		const outcome = await signInThrottle.attempt(async () => {
			try {
				// sveltekitCookies replays the Set-Cookie header this produces through event.cookies.
				await auth.api.signInEmail({
					body: { email, password },
					headers: event.request.headers
				});
				return true;
			} catch (error) {
				if (error instanceof APIError) return false;
				throw error;
			}
		});

		if (outcome === 'locked')
			return fail(429, {
				email,
				error: 'Too many failed sign-ins. Wait a minute and try again.'
			});
		if (outcome === 'failed') return fail(400, { email, error: 'Incorrect email or password.' });

		redirect(303, safeRedirectTarget(event.url.searchParams.get('redirectTo'), event.url.origin));
	}
};
