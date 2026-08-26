import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { hasUser } from '$lib/server/setup';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { guardRedirect } from '$lib/server/guard';

const handleAuth: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

const handleGuard: Handle = async ({ event, resolve }) => {
	const target = guardRedirect({
		pathname: event.url.pathname,
		search: event.url.search,
		userExists: await hasUser(),
		signedIn: Boolean(event.locals.user)
	});

	if (target) redirect(303, target);

	return resolve(event);
};

export const handle: Handle = sequence(handleAuth, handleGuard);
