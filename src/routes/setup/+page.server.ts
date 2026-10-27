import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import type { User } from 'better-auth';
import { auth, MIN_PASSWORD_LENGTH } from '$lib/server/auth';
import { createFirstUser } from '$lib/server/setup';
import type { Actions } from './$types';

type SetupField = 'name' | 'email' | 'password' | 'confirmPassword';

export const actions: Actions = {
	default: async (event) => {
		const data = await event.request.formData();
		const email = String(data.get('email') ?? '').trim();
		const name = String(data.get('name') ?? '').trim();
		const password = String(data.get('password') ?? '');
		const confirmPassword = String(data.get('confirmPassword') ?? '');
		const entered = { email, name };

		// Every refusal names the field it is about, so the page marks that input without reading the
		// message. One shape for all of them keeps `form` one type on the page.
		const refuse = (status: number, field: SetupField | undefined, error: string) =>
			fail(status, { ...entered, field, error });

		if (!email || !name)
			return refuse(400, !name ? 'name' : 'email', 'Name and email are required.');
		if (password.length < MIN_PASSWORD_LENGTH)
			return refuse(
				400,
				'password',
				`Choose a password of at least ${MIN_PASSWORD_LENGTH} characters.`
			);
		if (password !== confirmPassword)
			return refuse(400, 'confirmPassword', 'The two passwords do not match.');

		let created: User | null;
		try {
			created = await createFirstUser({ email, password, name });
		} catch (error) {
			// The create undoes its own user row if the credential cannot be written, so the wizard is
			// still usable: say so rather than redirecting to a /login that would refuse this password.
			console.error('Setup could not create the user', error);
			return refuse(500, undefined, 'The account could not be created. Try again.');
		}

		// A queued submission found the user already there, so the credentials just entered are not
		// the ones stored. There is nothing to sign in with here.
		if (!created) redirect(303, '/login');

		// sveltekitCookies replays the Set-Cookie through event.cookies, so the wizard finishes signed
		// in — the first thing a new install shows should be the app, not another form. A concurrent
		// submission that lost the same-email race may have typed a different password; that is a
		// login, not a failed setup.
		try {
			await auth.api.signInEmail({ body: { email, password }, headers: event.request.headers });
		} catch (error) {
			if (!(error instanceof APIError)) throw error;
			redirect(303, '/login');
		}

		redirect(303, '/');
	}
};
