import { test, expect } from '@playwright/test';
import {
	BEARER,
	standingKey,
	keysOf,
	openPage,
	plusDays,
	runFixture,
	todayIso,
	type Page
} from './helpers.ts';

// Covers the two Term endpoints over real HTTP (issue #164): reading the year back and replacing
// it as one document, with every refusal the seam owns — the wrong count, an unreal date, a Term
// opening after it closes, and two that touch. Clears the year itself in beforeAll, so the first
// read is empty, and runs after the Blocked Day file as it did before the split, so the at-risk
// report reads the same.
test.describe.serial('the Term endpoints', () => {
	let page: Page;
	let token = '';

	test.beforeAll(async ({ browser }) => {
		runFixture('clear-terms');
		page = await openPage(browser);
		token = await standingKey(page);
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('the Term endpoints read the year back and replace it as one document', async ({
		request
	}) => {
		// Both routes answer a missing key the way every other route does.
		expect((await request.get('/api/terms')).status()).toBe(401);
		expect((await request.put('/api/terms', { data: { terms: [] } })).status()).toBe(401);

		// Cleared in beforeAll, so the read starts empty.
		const empty = await request.get('/api/terms', { headers: BEARER(token) });
		expect(empty.status()).toBe(200);
		expect(await empty.json()).toEqual({ terms: [] });

		// Six Terms spanning today, given in no particular order — the read derives the names
		// from position and answers 200 with the new six beside an empty at-risk report.
		// Term validation only checks open-before-close and no overlap (terms.ts) — no weekday
		// rule — so these offsets from today hold whatever real weekday the suite runs on.
		const opens = [-84, -14, 70, 98, 126, 154].map((d) => plusDays(todayIso(), d));
		const closes = [-21, 56, 84, 112, 140, 168].map((d) => plusDays(todayIso(), d));
		const shuffled = [3, 0, 5, 1, 4, 2].map((i) => ({ opens: opens[i], closes: closes[i] }));

		const put = await request.put('/api/terms', {
			headers: BEARER(token),
			data: { terms: shuffled, note: 'an extra field the app never sends' }
		});
		expect(put.status()).toBe(200);
		const report = await put.json();
		expect(report.atRisk).toEqual([]);
		expect(report.terms.map((t: { name: string }) => t.name)).toEqual([
			'Autumn 1',
			'Autumn 2',
			'Spring 1',
			'Spring 2',
			'Summer 1',
			'Summer 2'
		]);
		for (const t of report.terms) {
			expect(keysOf(t)).toEqual(['closes', 'name', 'opens']);
		}

		const read = await request.get('/api/terms', { headers: BEARER(token) });
		expect(await read.json()).toEqual({ terms: report.terms });

		// Every Term rule is the seam's, and the first error wins: the wrong count, an unreal
		// date, a Term opening after it closes, and two that touch.
		const five = await request.put('/api/terms', {
			headers: BEARER(token),
			data: { terms: shuffled.slice(1) }
		});
		expect(five.status()).toBe(400);
		expect(await five.json()).toEqual({
			error: 'A year needs exactly six Terms, and 5 were given.'
		});

		const seven = await request.put('/api/terms', {
			headers: BEARER(token),
			data: {
				terms: [
					...shuffled,
					{ opens: plusDays(todayIso(), 200), closes: plusDays(todayIso(), 210) }
				]
			}
		});
		expect(seven.status()).toBe(400);
		expect(await seven.json()).toEqual({
			error: 'A year needs exactly six Terms, and 7 were given.'
		});

		const unreal = await request.put('/api/terms', {
			headers: BEARER(token),
			data: {
				terms: shuffled.map((t, i) => (i === 2 ? { opens: '2026-02-30', closes: t.closes } : t))
			}
		});
		expect(unreal.status()).toBe(400);
		expect(await unreal.json()).toEqual({ error: '"2026-02-30" is not a real date.' });

		const backwards = await request.put('/api/terms', {
			headers: BEARER(token),
			data: {
				terms: shuffled.map((t, i) => (i === 0 ? { opens: t.closes, closes: t.opens } : t))
			}
		});
		expect(backwards.status()).toBe(400);
		expect((await backwards.json()).error).toContain('A Term cannot open after it closes:');

		const touching = await request.put('/api/terms', {
			headers: BEARER(token),
			data: {
				terms: shuffled.map((t, i) => (i === 3 ? { opens: closes[0], closes: t.closes } : t))
			}
		});
		expect(touching.status()).toBe(400);
		expect((await touching.json()).error).toContain('Terms cannot overlap or touch:');
	});
});
