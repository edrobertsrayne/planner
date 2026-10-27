// One line per successful API write, for the container log (Dokploy). The write is otherwise
// invisible: a Lesson PATCH overwrites `body` and a Terms PUT replaces all six Terms, leaving no
// record but the key's `lastUsedAt`. A body is never logged, and a refusal is not a write. Only the
// Planning API zone writes; Better Auth's endpoints and the app are silent.
import type { Zone } from './zone';

export function apiWriteLine({
	zone,
	method,
	pathname,
	status
}: {
	zone: Zone;
	method: string;
	pathname: string;
	status: number;
}): string | null {
	if (zone !== 'api') return null;
	if (method === 'GET' || method === 'HEAD') return null;
	if (status < 200 || status >= 300) return null;
	return `${method} ${pathname} ${status}`;
}
