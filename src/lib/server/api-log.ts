// One line per successful API write, for the container log (Dokploy). The write is otherwise
// invisible: a Lesson PATCH overwrites `body` and a Terms PUT replaces all six Terms, leaving no
// record but the key's `lastUsedAt`. A body is never logged, and a refusal is not a write.
export function apiWriteLine({
	method,
	pathname,
	status
}: {
	method: string;
	pathname: string;
	status: number;
}): string | null {
	if (method === 'GET' || method === 'HEAD') return null;
	if (!pathname.startsWith('/api/') || pathname.startsWith('/api/auth/')) return null;
	if (status < 200 || status >= 300) return null;
	return `${method} ${pathname} ${status}`;
}
