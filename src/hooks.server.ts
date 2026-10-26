import { error, json, redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { hasUser } from '$lib/server/setup';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { runWithRequestState } from '@better-auth/core/context';
import { crossSiteFormRefused, guardRedirect } from '$lib/server/guard';
import { bodyTooLarge } from '$lib/server/body-limit';
import { requireApiKey } from '$lib/server/api-key';
import { apiWriteLine } from '$lib/server/api-log';

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

// The API's one door: every `/api/*` request presents the bearer key here, before any handler
// runs, so a new route cannot be left open by forgetting two lines. Better Auth's own endpoints
// under `/api/auth/*` are a public surface of their own and check themselves.
const handleApiKey: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;
	if (!pathname.startsWith('/api/') || pathname.startsWith('/api/auth/')) return resolve(event);

	const refused = await requireApiKey(event);
	if (refused) return refused;
	return resolve(event);
};

// The trace an API write leaves in the container log: one line, no body. A refusal was not a write
// and is not logged; the status has to be read after the response is produced.
const handleApiLog: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	const line = apiWriteLine({
		method: event.request.method,
		pathname: event.url.pathname,
		status: response.status
	});
	if (line) console.info(line);
	return response;
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
	// The API answers 401 from its own key check and never consults the session, so the query that
	// answers "is there a user at all" is skipped for it.
	if (event.url.pathname.startsWith('/api/')) return resolve(event);

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
	handleApiLog,
	handleApiKey,
	handleAuth,
	handleGuard
);
