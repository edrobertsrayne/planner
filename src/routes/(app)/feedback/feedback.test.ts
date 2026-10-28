// Contract tests for `GET|POST /feedback`: JSON in, `{ number, url }` or `{ error }` out. The
// model and GitHub are stubs (zero real calls).

import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { GET, POST } from './+server';
import { clearEnvForTests, setEnvForTests } from '$lib/server/env';
import { resetFeedbackFetch, setFeedbackFetch } from '$lib/server/feedback';
import {
	resetStructuredTransport,
	setStructuredTransport,
	StructuredModelError,
	type StructuredModelInput
} from '$lib/server/openrouter';

const ISSUE_URL = 'https://github.com/edrobertsrayne/planner/issues/42';

interface Envelope {
	number?: number;
	url?: string;
	enabled?: boolean;
	error?: string;
	retryable?: boolean;
}

let modelCalls: StructuredModelInput[];
let githubCalls: { url: string; init?: RequestInit }[];

function stubModel(content: string | Error): void {
	setStructuredTransport(async (input) => {
		modelCalls.push(input);
		if (content instanceof Error) throw content;
		return { content };
	});
}

function stubGithub(respond: () => Response): void {
	setFeedbackFetch(async (url, init) => {
		githubCalls.push({ url, init });
		return respond();
	});
}

function created(): Response {
	return Response.json({ number: 42, html_url: ISSUE_URL }, { status: 201 });
}

async function post(payload: unknown): Promise<{ status: number; json: Envelope }> {
	const request = new Request('http://localhost/feedback', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload)
	});
	const response = await POST({ request } as unknown as Parameters<typeof POST>[0]);
	return { status: response.status, json: (await response.json()) as Envelope };
}

beforeEach(() => {
	modelCalls = [];
	githubCalls = [];
	setEnvForTests('OPENROUTER_MODEL', '');
	setEnvForTests('GITHUB_FEEDBACK_TOKEN', 't');
	stubModel('{"title":"x"}');
	stubGithub(created);
});

afterEach(() => {
	clearEnvForTests();
	resetFeedbackFetch();
	resetStructuredTransport();
});

describe('GET /feedback', () => {
	test('reports whether a token is configured', async () => {
		setEnvForTests('GITHUB_FEEDBACK_TOKEN', '');
		const off = await GET({} as Parameters<typeof GET>[0]);
		expect(await off.json()).toEqual({ enabled: false });

		setEnvForTests('GITHUB_FEEDBACK_TOKEN', 't');
		const on = await GET({} as Parameters<typeof GET>[0]);
		expect(await on.json()).toEqual({ enabled: true });
	});
});

describe('POST /feedback', () => {
	test('refuses without a token, calling nothing', async () => {
		setEnvForTests('GITHUB_FEEDBACK_TOKEN', '');
		const { status, json } = await post({ text: 'x', page: '/' });
		expect(status).toBe(500);
		expect(json.error).toBe('Feedback is not configured on the server.');
		expect(modelCalls).toHaveLength(0);
		expect(githubCalls).toHaveLength(0);
	});

	test('rejects blank text and unknown keys', async () => {
		const blank = await post({ text: '   ', page: '/' });
		expect(blank.status).toBe(400);
		expect(blank.json.error).toBe('Write some feedback first.');

		const extra = await post({ text: 'x', page: '/', extra: 1 });
		expect(extra.status).toBe(400);
		expect(extra.json.error).toBe('Unknown field "extra".');
	});

	test('files an issue titled by the model', async () => {
		stubModel('{"title":"Grid header overlaps the first row"}');
		const { status, json } = await post({
			text: 'Grid header overlaps\nmore detail',
			page: '/calendar'
		});
		expect(status).toBe(201);
		expect(json).toEqual({ number: 42, url: ISSUE_URL });
	});

	test('falls back to the first line when the model fails', async () => {
		stubModel(new StructuredModelError('x', { code: 'MODEL_RETRYABLE', retryable: true }));
		const { status } = await post({ text: 'Grid header overlaps\nmore detail', page: '/' });
		expect(status).toBe(201);
		const body = JSON.parse(String(githubCalls[0]?.init?.body));
		expect(body.title).toBe('Feedback: Grid header overlaps');
	});

	test('maps a GitHub refusal to a 502 with the reason', async () => {
		stubGithub(() => new Response('{}', { status: 401 }));
		const { status, json } = await post({ text: 'x', page: '/' });
		expect(status).toBe(502);
		expect(json).toEqual({
			error: 'GitHub refused the issue (status 401).',
			retryable: false
		});
	});

	test('rejects a body that is not a JSON object', async () => {
		const request = new Request('http://localhost/feedback', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: '{'
		});
		const response = await POST({ request } as unknown as Parameters<typeof POST>[0]);
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: 'The body must be a JSON object.' });
	});
});
