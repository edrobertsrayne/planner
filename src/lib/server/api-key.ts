import { text } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import { apiKey } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';

const UNAUTHORIZED = text('{"error":"Give a valid API key in the Authorization header."}', {
	status: 401,
	headers: { 'content-type': 'application/json' }
});

async function hashToken(token: string): Promise<string> {
	const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
	return Array.from(new Uint8Array(hashBuffer))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

export async function requireApiKey(event: RequestEvent): Promise<Response | void> {
	const header = event.request.headers.get('Authorization');
	if (!header || !header.startsWith('Bearer ')) return UNAUTHORIZED;

	const token = header.slice(7).trim();
	if (!token) return UNAUTHORIZED;

	const hash = await hashToken(token);

	const result = await db
		.update(apiKey)
		.set({ lastUsedAt: Date.now() })
		.where(eq(apiKey.hash, hash))
		.returning({ id: apiKey.id });

	if (result.length === 0) return UNAUTHORIZED;
}
