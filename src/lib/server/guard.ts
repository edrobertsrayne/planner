import { matches, type Zone } from './zone';

/**
 * The one place that answers where a request in the app should be sent. Three states, in order: no
 * user at all means the app is unconfigured and everything goes to the wizard; a user but no
 * session goes to the login page; a configured, signed-in visitor has no business on either.
 *
 * Only the app is guarded. The API has its own bearer-key check and the auth endpoints check
 * themselves, so a request in either of those zones is never redirected.
 *
 * Returns the path to redirect to, or null to let the request through.
 */
export function guardRedirect(request: {
	zone: Zone;
	pathname: string;
	search: string;
	userExists: boolean;
	signedIn: boolean;
}): string | null {
	if (request.zone !== 'app') return null;

	const isSetup = matches(request.pathname, '/setup');

	if (!request.userExists) return isSetup ? null : '/setup';

	if (!request.signedIn) {
		if (isSetup) return '/login';
		if (isPublicRoute(request.pathname)) return null;
		return `/login?redirectTo=${encodeURIComponent(request.pathname + request.search)}`;
	}

	if (isSetup) return '/';
	return isPublicRoute(request.pathname) ? '/' : null;
}

/**
 * SvelteKit's own CSRF check refuses any form-typed write without a matching `Origin` header,
 * which a script uploading a file with a Bearer key never sends. It cannot be scoped to a path, so
 * `vite.config.ts` turns it off and this applies the same rule to the app zone. Neither API zone
 * carries an ambient credential a forged browser form could ride on (each route needs the Bearer
 * key, and `/api/auth/*` runs Better Auth's own origin check).
 */
export function crossSiteFormRefused(request: {
	zone: Zone;
	method: string;
	pathname: string;
	contentType: string | null;
	origin: string | null;
	siteOrigin: string;
}): boolean {
	if (request.zone !== 'app') return false;
	if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return false;
	const isForm =
		/^\s*(application\/x-www-form-urlencoded|multipart\/form-data|text\/plain)\s*(;|$)/i.test(
			request.contentType ?? ''
		);
	return isForm && request.origin !== request.siteOrigin;
}

const PUBLIC_ROUTES = ['/login'];

export function isPublicRoute(pathname: string) {
	return PUBLIC_ROUTES.some((route) => matches(pathname, route));
}
