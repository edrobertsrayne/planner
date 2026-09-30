/**
 * The largest request body any route but Restore accepts. The Bun server has one limit for the
 * whole app (`BODY_SIZE_LIMIT`), and Restore needs it far above this, so the limit for every other
 * route is enforced here instead (ADR-0024). It sits above the 10 MiB Attachment ceiling plus
 * multipart overhead.
 */
export const BODY_LIMIT = 12 * 1024 * 1024;

export const RESTORE_PATH = '/setup/restore';

/** Whether to refuse the request for the size of its body. A body with no declared length (chunked)
 * cannot be measured up front, so it is refused too: the app's own forms always declare one. */
export function bodyTooLarge(request: { pathname: string; headers: Headers }): boolean {
	if (request.pathname === RESTORE_PATH) return false;
	if (request.headers.has('transfer-encoding')) return true;
	return Number(request.headers.get('content-length') ?? 0) > BODY_LIMIT;
}
