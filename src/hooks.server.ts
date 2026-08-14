import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';

// Routes reachable without a session, besides /api/auth/* (excluded below by svelteKitHandler
// itself, not by this list). `handle` never runs for static assets, so between the two, every
// other route is protected by default.
const PUBLIC_ROUTES = ['/login'];

export function isPublicRoute(pathname: string) {
	return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
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
	const isPublic = isPublicRoute(event.url.pathname);

	if (!isPublic && !event.locals.user) {
		const target = event.url.pathname + event.url.search;
		redirect(303, `/login?redirectTo=${encodeURIComponent(target)}`);
	}

	if (isPublic && event.locals.user) {
		redirect(303, '/');
	}

	return resolve(event);
};

export const handle: Handle = sequence(handleAuth, handleGuard);
