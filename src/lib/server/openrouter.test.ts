// The one OpenRouter transport: payload shape, headers, fence stripping, and the status map.
// The fetch is stubbed (zero real model calls).

import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { clearEnvForTests, setEnvForTests } from './env';
import {
	callStructuredModel,
	MODEL_RETRYABLE_CODE,
	OPENROUTER_URL,
	resetStructuredFetch,
	setStructuredFetch,
	type StructuredModelInput
} from './openrouter';

const INPUT: StructuredModelInput = {
	modelId: 'test/model',
	systemPrompt: 'Write a title.',
	data: { feedback: 'x', page: '/' },
	schemaName: 'feedback_title',
	schema: {
		type: 'object',
		properties: { title: { type: 'string' } },
		required: ['title'],
		additionalProperties: false
	},
	caller: { referer: 'https://planner.local/feedback', title: 'Planner Feedback title' },
	maxTokens: 200,
	timeoutMs: 1000
};

let calls: { url: string; init?: RequestInit }[];

function stubFetch(respond: () => Response): void {
	setStructuredFetch(async (url, init) => {
		calls.push({ url, init });
		return respond();
	});
}

function answer(content: unknown): Response {
	return Response.json({ choices: [{ message: { content } }] });
}

beforeEach(() => {
	calls = [];
	setEnvForTests('OPENROUTER_API_KEY', 'k');
});

afterEach(() => {
	clearEnvForTests();
	resetStructuredFetch();
});

describe('the OpenRouter transport', () => {
	test('sends one strict structured call with the caller data fenced off', async () => {
		stubFetch(() => answer('{"title":"x"}'));
		const result = await callStructuredModel(INPUT);

		expect(result).toEqual({ content: '{"title":"x"}' });
		const [call] = calls;
		expect(call?.url).toBe(OPENROUTER_URL);
		const headers = call?.init?.headers as Record<string, string>;
		expect(headers.Authorization).toBe('Bearer k');
		expect(headers['X-Title']).toBe('Planner Feedback title');

		const body = JSON.parse(String(call?.init?.body));
		expect(body.model).toBe('test/model');
		expect(body.max_tokens).toBe(200);
		expect(body.stream).toBe(false);
		expect(body.provider).toEqual({ require_parameters: true });
		expect(body.response_format).toEqual({
			type: 'json_schema',
			json_schema: {
				name: 'feedback_title',
				strict: true,
				schema: INPUT.schema
			}
		});
		expect(body.messages[0].role).toBe('system');
		expect(body.messages[0].content).toContain('Write a title.');
		expect(body.messages[1].content).toContain('<feedback>');
		expect(body.messages[1].content).toContain('{"feedback":"x","page":"/"}');
	});

	test('strips a markdown fence around the model JSON', async () => {
		stubFetch(() => answer('```json\n{"title":"x"}\n```'));
		expect(await callStructuredModel(INPUT)).toEqual({ content: '{"title":"x"}' });
	});

	test('reads a parts-array message', async () => {
		stubFetch(() => answer([{ type: 'text', text: '{"title":"x"}' }]));
		expect(await callStructuredModel(INPUT)).toEqual({ content: '{"title":"x"}' });
	});

	test('refuses without a key', async () => {
		setEnvForTests('OPENROUTER_API_KEY', '');
		await expect(callStructuredModel(INPUT)).rejects.toThrow(
			'Server is missing its OpenRouter API key.'
		);
		expect(calls).toHaveLength(0);
	});

	test.each([
		[401, false],
		[402, false],
		[429, true],
		[500, true]
	])('maps status %i to retryable %s', async (status, retryable) => {
		stubFetch(() => new Response('{}', { status }));
		await expect(callStructuredModel(INPUT)).rejects.toMatchObject({
			name: 'StructuredModelError',
			retryable
		});
	});

	test('maps a network failure to a retryable error', async () => {
		setStructuredFetch(async () => {
			throw new Error('offline');
		});
		await expect(callStructuredModel(INPUT)).rejects.toMatchObject({
			code: MODEL_RETRYABLE_CODE,
			retryable: true
		});
	});

	test('treats a cut-off or empty answer as retryable', async () => {
		stubFetch(() => Response.json({ choices: [{ message: {}, finish_reason: 'length' }] }));
		await expect(callStructuredModel(INPUT)).rejects.toMatchObject({
			code: MODEL_RETRYABLE_CODE,
			retryable: true
		});

		stubFetch(() => answer('   '));
		await expect(callStructuredModel(INPUT)).rejects.toMatchObject({
			code: MODEL_RETRYABLE_CODE,
			retryable: true
		});
	});
});
