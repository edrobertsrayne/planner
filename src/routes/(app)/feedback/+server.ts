// `GET|POST /feedback` — the in-app feedback button.
//
// GET answers `{ enabled }` (a GitHub token is configured). POST takes JSON and answers
// `{ number, url }` of the new issue (`fileFeedback`: titled on the configured model, first-line
// fallback). Request bodies and the token are never logged.

import { json } from '@sveltejs/kit';
import { readJson } from '$lib/server/api-helpers';
import { getServerEnv } from '$lib/server/env';
import {
	FeedbackError,
	FeedbackInputError,
	fileFeedback,
	validateFeedbackBody
} from '$lib/server/feedback';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () =>
	json(
		{ enabled: getServerEnv('GITHUB_FEEDBACK_TOKEN') !== '' },
		{ headers: { 'Cache-Control': 'no-store' } }
	);

export const POST: RequestHandler = async ({ request }) => {
	const token = getServerEnv('GITHUB_FEEDBACK_TOKEN');
	if (token === '') {
		return json({ error: 'Feedback is not configured on the server.' }, { status: 500 });
	}

	const body = await readJson(request);
	if (body instanceof Response) return body;

	try {
		return json(await fileFeedback(token, validateFeedbackBody(body)), { status: 201 });
	} catch (error) {
		if (error instanceof FeedbackInputError) {
			return json({ error: error.message }, { status: 400 });
		}
		if (error instanceof FeedbackError) {
			return json({ error: error.message, retryable: error.retryable }, { status: 502 });
		}
		throw error;
	}
};
