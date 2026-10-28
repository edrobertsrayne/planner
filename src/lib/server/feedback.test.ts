// The feedback seam: validation, the model's title (and its fallback), and filing on GitHub.
// Zero real model or GitHub calls.

import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { clearEnvForTests, setEnvForTests } from './env';
import {
	DEFAULT_MODEL_ID,
	MODEL_RETRYABLE_CODE,
	resetStructuredTransport,
	setStructuredTransport,
	StructuredModelError,
	type StructuredModelInput
} from './openrouter';
import {
	FeedbackError,
	fileFeedback,
	resetFeedbackFetch,
	setFeedbackFetch,
	validateFeedbackBody
} from './feedback';

const ISSUE_URL = 'https://github.com/edrobertsrayne/planner/issues/42';

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

function filedTitle(): string {
	const body = githubCalls[0]?.init?.body;
	return JSON.parse(String(body)).title;
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

describe('validateFeedbackBody', () => {
	test('accepts a note and a page', () => {
		expect(validateFeedbackBody({ text: 'A note', page: '/calendar' })).toEqual({
			text: 'A note',
			page: '/calendar'
		});
	});

	test('rejects a blank note', () => {
		expect(() => validateFeedbackBody({ text: '   ', page: '/' })).toThrow(
			'Write some feedback first.'
		);
	});

	test('rejects an unknown field', () => {
		expect(() => validateFeedbackBody({ text: 'x', page: '/', extra: 1 })).toThrow(
			'Unknown field "extra".'
		);
	});

	test('caps the note and the page', () => {
		expect(() => validateFeedbackBody({ text: 'a'.repeat(10_001), page: '/' })).toThrow(
			'Must be at most 10000 characters.'
		);
		expect(() => validateFeedbackBody({ text: 'x', page: '/'.repeat(501) })).toThrow(
			'Must be at most 500 characters.'
		);
	});
});

describe('fileFeedback', () => {
	test('files an issue titled by the model', async () => {
		stubModel('{"title":"Grid header overlaps the first row"}');
		const issue = await fileFeedback('t', {
			text: 'Grid header overlaps\nmore detail',
			page: '/calendar'
		});

		expect(issue).toEqual({ number: 42, url: ISSUE_URL });
		expect(modelCalls[0]?.modelId).toBe(DEFAULT_MODEL_ID);
		expect(modelCalls[0]?.data).toEqual({
			feedback: 'Grid header overlaps\nmore detail',
			page: '/calendar'
		});

		const call = githubCalls[0];
		expect(call?.url).toBe('https://api.github.com/repos/edrobertsrayne/planner/issues');
		expect((call?.init?.headers as Record<string, string>).Authorization).toBe('Bearer t');
		const body = JSON.parse(String(call?.init?.body));
		expect(body.title).toBe('Grid header overlaps the first row');
		expect(body.labels).toEqual(['needs-triage']);
		expect(body.body).toContain('Grid header overlaps\nmore detail');
		expect(body.body).toContain('Page: `/calendar`');
	});

	test('uses OPENROUTER_MODEL when set', async () => {
		setEnvForTests('OPENROUTER_MODEL', 'env/model');
		await fileFeedback('t', { text: 'x', page: '/' });
		expect(modelCalls[0]?.modelId).toBe('env/model');
	});

	test('falls back to the first line when the model fails', async () => {
		stubModel(new StructuredModelError('x', { code: MODEL_RETRYABLE_CODE, retryable: true }));
		await fileFeedback('t', { text: 'Grid header overlaps\nmore detail', page: '/' });
		expect(filedTitle()).toBe('Feedback: Grid header overlaps');
	});

	test.each([['{"title":""}'], [JSON.stringify({ title: 'a'.repeat(81) })], ['{"title":"a\\nb"}']])(
		'falls back on an unusable title %#',
		async (content) => {
			stubModel(content);
			await fileFeedback('t', { text: 'Grid header overlaps', page: '/' });
			expect(filedTitle()).toBe('Feedback: Grid header overlaps');
		}
	);

	test('caps a long fallback title at 80 characters', async () => {
		stubModel(new StructuredModelError('x', { code: MODEL_RETRYABLE_CODE, retryable: true }));
		await fileFeedback('t', { text: 'a'.repeat(100), page: '/' });
		expect(filedTitle()).toHaveLength(80);
	});

	test('lets a non-model error escape instead of masking it as a fallback', async () => {
		stubModel(new TypeError('bug'));
		await expect(fileFeedback('t', { text: 'x', page: '/' })).rejects.toThrow('bug');
		expect(githubCalls).toHaveLength(0);
	});

	test('maps a GitHub refusal to a non-retryable failure', async () => {
		stubGithub(() => new Response('{}', { status: 401 }));
		await expect(fileFeedback('t', { text: 'x', page: '/' })).rejects.toMatchObject({
			name: 'FeedbackError',
			code: 'GITHUB_REJECTED',
			retryable: false
		} satisfies Partial<FeedbackError>);
	});

	test('maps an unreachable GitHub to a retryable failure', async () => {
		setFeedbackFetch(async () => {
			throw new Error('offline');
		});
		await expect(fileFeedback('t', { text: 'x', page: '/' })).rejects.toMatchObject({
			name: 'FeedbackError',
			code: 'GITHUB_UNREACHABLE',
			retryable: true
		} satisfies Partial<FeedbackError>);
	});
});
