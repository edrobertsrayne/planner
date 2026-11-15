// A target becomes a `Location` header on this origin, so the only safe ones are paths that stay
// here. Parsing against the request origin and comparing origins catches what `startsWith('/')`
// cannot: browsers treat a backslash as a slash and drop a tab outright, so `/\evil.example` and
// `//evil.example` both leave; an absolute URL replaces the origin outright. Resolving dot
// segments can also leave a path that begins `//` (`/.//evil.example`), which the browser reads as
// another host, so the resolved path is checked too. A target the parser refuses (`//[`) names no
// page here either.
export function safeRedirectTarget(target: string | null, origin: string) {
	const url = URL.parse(target ?? '/', origin);
	if (!url || url.origin !== origin || url.pathname.startsWith('//')) return '/';
	return url.pathname + url.search + url.hash;
}
