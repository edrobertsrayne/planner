import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { hasUser } from '$lib/server/setup';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { crossSiteFormRefused, guardRedirect } from '$lib/server/guard';

const handleCsrf: Handle = async ({ event, resolve }) => {
	const refused = crossSiteFormRefused({
		method: event.request.method,
		pathname: event.url.pathname,
		contentType: event.request.headers.get('content-type'),
		origin: event.request.headers.get('origin'),
		siteOrigin: event.url.origin
	});
	if (refused) {
		return new Response(`Cross-site ${event.request.method} form submissions are forbidden`, {
			status: 403
		});
	}
	return resolve(event);
};

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

export const handle: Handle = sequence(handleCsrf, handleAuth, handleGuard);
