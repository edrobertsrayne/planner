/**
 * Where a request belongs. Decided once per request (hooks.server.ts puts it on
 * `event.locals.zone`), so no later handler re-derives it from the path.
 *
 * - `auth`: Better Auth's endpoints under `/api/auth`. They are a public surface of their own, with
 *   their own handler and checks.
 * - `api`: the Planning API under `/api`. Every request presents the bearer key, and a write is
 *   logged.
 * - `app`: every page, the wizard, the login page and anything else. The guard decides, and the
 *   session is read.
 */
export type Zone = 'auth' | 'api' | 'app';

export function zoneOf(pathname: string): Zone {
	if (matches(pathname, '/api/auth')) return 'auth';
	if (matches(pathname, '/api')) return 'api';
	return 'app';
}

/** Whether `pathname` is `route` itself or a child of it: `/api` matches `/api` and `/api/x`, but
 * not `/apix`. */
export function matches(pathname: string, route: string): boolean {
	return pathname === route || pathname.startsWith(`${route}/`);
}
