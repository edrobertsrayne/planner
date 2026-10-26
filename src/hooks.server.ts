import { error, json, redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { hasUser } from '$lib/server/setup';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { runWithRequestState } from '@better-auth/core/context';
import { crossSiteFormRefused, guardRedirect } from '$lib/server/guard';
import { bodyTooLarge } from '$lib/server/body-limit';

// Every response, pages and downloads alike: no file is sniffed into another type, a link out
// carries no path from this app, and no page can be framed. A stored-XSS bug in a Lesson body is
// then contained to the app's own origin (#431).
const handleSecurityHeaders: Handle = ({ event, resolve }) => {
	event.setHeaders({
		'x-content-type-options': 'nosniff',
		'referrer-policy': 'same-origin',
		'content-security-policy': "frame-ancestors 'none'"
	});
	return resolve(event);
};

const handleBodyLimit: Handle = ({ event, resolve }) => {
	if (bodyTooLarge({ pathname: event.url.pathname, headers: event.request.headers })) {
		// The API answers every error as JSON with an `error` key (spec §3.2), including this one;
		// a browser page keeps the framework's own error page.
		if (event.url.pathname.startsWith('/api/')) {
			return json({ error: 'The request body is too large.' }, { status: 413 });
		}
		error(413, 'The request body is too large.');
	}
	return resolve(event);
};

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
	// Reading the session also refreshes it, which is how a teacher who works every day is never
	// signed out — and that path asks the auth library for its per-request state, which nothing else
	// has set up on the way into the hook chain. The library's own endpoints wrap themselves the
	// same way; without it the read throws and every page it guards answers 500. One state map per
	// request, since the call sits outside any endpoint that would have made one.
	const session = await runWithRequestState(new WeakMap(), () =>
		auth.api.getSession({ headers: event.request.headers })
	);

	if (session) {
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

export const handle: Handle = sequence(
	handleSecurityHeaders,
	handleBodyLimit,
	handleCsrf,
	handleAuth,
	handleGuard
);
