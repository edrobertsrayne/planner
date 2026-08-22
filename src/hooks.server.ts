import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { building, dev } from '$app/environment';
import { auth } from '$lib/server/auth';
import { hasUser } from '$lib/server/setup';
import { svelteKitHandler } from 'better-auth/svelte-kit';

// Routes reachable without a session, besides /api/auth/* (excluded below by svelteKitHandler
// itself, not by this list). `handle` never runs for static assets, so between the two, every
// other route is protected by default.
const PUBLIC_ROUTES = ['/login'];
const SETUP_ROUTE = '/setup';

function matches(pathname: string, route: string) {
	return pathname === route || pathname.startsWith(`${route}/`);
}

export function isPublicRoute(pathname: string) {
	return PUBLIC_ROUTES.some((route) => matches(pathname, route));
}

/**
 * The one place that answers "where does this request belong". Three states, in order: no user at
 * all means the app is unconfigured and everything goes to the wizard; a user but no session goes
 * to the login page; a configured, signed-in visitor has no business on either.
 *
 * Returns the path to redirect to, or null to let the request through.
 */
export function guardRedirect(request: {
	pathname: string;
	search: string;
	userExists: boolean;
	signedIn: boolean;
}): string | null {
	const isSetup = matches(request.pathname, SETUP_ROUTE);

	if (!request.userExists) return isSetup ? null : SETUP_ROUTE;

	if (!request.signedIn) {
		// isSetup is checked here, not folded into isPublicRoute, so a signed-out visitor goes
		// straight to /login rather than bouncing through '/' first.
		if (isSetup) return '/login';
		if (isPublicRoute(request.pathname)) return null;
		return `/login?redirectTo=${encodeURIComponent(request.pathname + request.search)}`;
	}

	if (isSetup) return '/';
	return isPublicRoute(request.pathname) ? '/' : null;
}

const handleAuth: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	// svelteKitHandler short-circuits /api/auth/* straight to the better-auth handler, so those
	// requests never reach handleGuard below.
	return svelteKitHandler({ event, resolve, auth, building });
};

const handleGuard: Handle = async ({ event, resolve }) => {
	// Throwaway prototype routes (src/routes/prototype/*) serve fixtures and never touch the
	// database, so there is nothing behind this gate for them to leak — and they have to be
	// viewable on a machine whose database is empty, where every other route bounces to /setup.
	// `dev` is statically false in a build, so this branch cannot exist in production.
	if (dev && event.url.pathname.startsWith('/prototype')) return resolve(event);

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
