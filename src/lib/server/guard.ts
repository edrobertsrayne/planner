/**
 * The one place that answers "where does this request belong". Three states, in order: no user at
 * all means the app is unconfigured and everything goes to the wizard; a user but no session goes
 * to the login page; a configured, signed-in visitor has no business on either.
 *
 * `/api/*` is handled by its own bearer-key check and must not be redirected — it returns null
 * regardless of auth state.
 *
 * Returns the path to redirect to, or null to let the request through.
 */
export function guardRedirect(request: {
	pathname: string;
	search: string;
	userExists: boolean;
	signedIn: boolean;
}): string | null {
	if (matches(request.pathname, '/api')) return null;

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

const PUBLIC_ROUTES = ['/login'];

function matches(pathname: string, route: string) {
	return pathname === route || pathname.startsWith(`${route}/`);
}

export function isPublicRoute(pathname: string) {
	return PUBLIC_ROUTES.some((route) => matches(pathname, route));
}