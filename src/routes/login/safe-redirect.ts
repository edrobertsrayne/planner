// A target becomes a `Location` header on this origin, so the only safe ones are paths that stay
// here. Parsing against the request origin and comparing origins catches what `startsWith('/')`
// cannot: browsers treat a backslash as a slash and drop a tab outright, so `/\evil.example` and
// `//evil.example` both leave; an absolute URL replaces the origin outright.
export function safeRedirectTarget(target: string | null, origin: string) {
	const url = new URL(target ?? '/', origin);
	return url.origin === origin ? url.pathname + url.search + url.hash : '/';
}
