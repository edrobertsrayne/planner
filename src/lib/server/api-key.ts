import { text } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import { apiKey } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';

// A fresh Response per call — a Response body can be read only once, so a shared constant would
// serve the first 401 and lock the body of every one after it.
const UNAUTHORIZED = () =>
	text('{"error":"Give a valid API key in the Authorization header."}', {
		status: 401,
		headers: { 'content-type': 'application/json' }
	});

export async function requireApiKey(event: RequestEvent): Promise<Response | void> {
	const header = event.request.headers.get('Authorization');
	if (!header || !header.startsWith('Bearer ')) return UNAUTHORIZED();

	const token = header.slice(7).trim();
	if (!token) return UNAUTHORIZED();

	const result = await db
		.update(apiKey)
		.set({ lastUsedAt: Date.now() })
		.where(eq(apiKey.token, token))
		.returning({ id: apiKey.id });

	if (result.length === 0) return UNAUTHORIZED();
}
