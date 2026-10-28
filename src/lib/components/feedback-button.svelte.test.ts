import { afterEach, describe, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import FeedbackButton from './feedback-button.svelte';
import Harness from './feedback-button-harness.test.svelte';

function stubFetch(enabled: boolean, post?: () => Response) {
	const stub = vi.fn(async (_url: string, init?: RequestInit) =>
		init?.method === 'POST' && post ? post() : Response.json({ enabled })
	);
	vi.stubGlobal('fetch', stub);
	return stub;
}

afterEach(() => vi.unstubAllGlobals());

describe('the feedback button', () => {
	test('is absent when feedback is not configured', async () => {
		stubFetch(false);
		render(FeedbackButton);
		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(page.getByRole('button', { name: 'Send feedback' }).query()).toBeNull();
	});

	test('sends the note and confirms with the issue number', async () => {
		const stub = stubFetch(true, () =>
			Response.json({ number: 7, url: 'https://example.test/7' }, { status: 201 })
		);
		render(Harness);
		await page.getByRole('button', { name: 'Send feedback' }).click();
		await page.getByRole('textbox', { name: 'Feedback' }).fill('Too many clicks');
		await page.getByRole('button', { name: 'Send', exact: true }).click();

		await expect.element(page.getByText('Feedback sent as issue #7')).toBeInTheDocument();
		await expect.element(page.getByRole('textbox', { name: 'Feedback' })).not.toBeInTheDocument();

		const postCall = stub.mock.calls.find(([, init]) => init?.method === 'POST');
		expect(JSON.parse(String(postCall?.[1]?.body))).toEqual({
			text: 'Too many clicks',
			page: location.pathname
		});
	});

	test('keeps the text and shows the error when sending fails', async () => {
		stubFetch(true, () =>
			Response.json({ error: 'GitHub refused the issue (status 401).' }, { status: 502 })
		);
		render(Harness);
		await page.getByRole('button', { name: 'Send feedback' }).click();
		await page.getByRole('textbox', { name: 'Feedback' }).fill('Too many clicks');
		await page.getByRole('button', { name: 'Send', exact: true }).click();

		await expect
			.element(page.getByText('GitHub refused the issue (status 401).'))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('textbox', { name: 'Feedback' }))
			.toHaveValue('Too many clicks');
	});
});
