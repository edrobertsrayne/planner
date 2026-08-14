import { redirect } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	// sveltekitCookies replays the Set-Cookie header this produces through event.cookies.
	await auth.api.signOut({ headers: event.request.headers });
	redirect(303, '/login');
};
