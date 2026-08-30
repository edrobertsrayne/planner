import { test, expect } from '@playwright/test';
import {
	BEARER,
	standingKey,
	keysOf,
	nextSaturday,
	nextWeekday,
	openPage,
	plusDays,
	todayIso,
	type Page
} from './helpers.ts';

// Covers the three Blocked Day endpoints over real HTTP (issues #159 and #165): the key check,
// the Rewind's at-risk report beside each write, the weekend and duplicate refusals, and removal
// by date. Needs no Course or Topic state, so it leans on no other file in the directory.
test.describe.serial('the Blocked Day endpoints', () => {
	let page: Page;
	let token = '';

	test.beforeAll(async ({ browser }) => {
		page = await openPage(browser);
		token = await standingKey(page);
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('the Blocked Day endpoints list, add and remove by date', async ({ request }) => {
		// Every route requires the key.
		expect((await request.get('/api/blocked-days')).status()).toBe(401);
		expect(
			(await request.post('/api/blocked-days', { data: { date: '2026-09-03' } })).status()
		).toBe(401);
		expect((await request.delete('/api/blocked-days/2026-09-03')).status()).toBe(401);

		// The whole year, in date order, no ids — a Blocked Day is addressed by date.
		const empty = await request.get('/api/blocked-days', { headers: BEARER(token) });
		expect(empty.status()).toBe(200);
		expect(await empty.json()).toEqual({ blockedDays: [] });

		// No Term needs to be set for a Blocked Day (see disruptions.ts) — this file leans only on
		// nextWeekday/nextSaturday to land on a real weekday or weekend, so these offsets from
		// today hold whatever real weekday the suite runs on, with no Term span to stay inside.
		const today = todayIso();
		const inset = nextWeekday(plusDays(today, 90));

		// A date with no note at all: 201, the note null, and the Rewind's report beside it.
		const created = await request.post('/api/blocked-days', {
			headers: BEARER(token),
			data: { date: inset }
		});
		expect(created.status()).toBe(201);
		const report = await created.json();
		expect(report.blockedDay).toEqual({ date: inset, note: null });
		expect(report.atRisk).toEqual([]);

		// A weekend is a 400 where an already-blocked date is a 409 — the two must be
		// distinguishable, and the teacher is told which.
		const saturday = nextSaturday(plusDays(today, 95));
		const weekend = await request.post('/api/blocked-days', {
			headers: BEARER(token),
			data: { date: saturday }
		});
		expect(weekend.status()).toBe(400);
		expect(await weekend.json()).toEqual({
			error: `"${saturday}" falls on a weekend. A Blocked Day must be a Monday to Friday.`
		});

		const duplicate = await request.post('/api/blocked-days', {
			headers: BEARER(token),
			data: { date: inset, note: 'INSET' }
		});
		expect(duplicate.status()).toBe(409);
		expect(await duplicate.json()).toEqual({
			error: `"${inset}" is already a Blocked Day.`
		});

		// The note is capped at its own ceiling, not the name's.
		const bankHoliday = nextWeekday(plusDays(today, 100));
		const capped = await request.post('/api/blocked-days', {
			headers: BEARER(token),
			data: { date: bankHoliday, note: 'x'.repeat(201) }
		});
		expect(capped.status()).toBe(400);
		expect((await capped.json()).error).toContain('at most 200');

		// Extra fields in a body are read and ignored.
		const withExtra = await request.post('/api/blocked-days', {
			headers: BEARER(token),
			data: { date: bankHoliday, note: 'Bank holiday', titel: 'extra' }
		});
		expect(withExtra.status()).toBe(201);
		expect((await withExtra.json()).blockedDay).toEqual({
			date: bankHoliday,
			note: 'Bank holiday'
		});

		const listed = await request.get('/api/blocked-days', { headers: BEARER(token) });
		expect(listed.status()).toBe(200);
		const list = (await listed.json()).blockedDays;
		expect(list.map((d: { date: string }) => d.date)).toEqual([inset, bankHoliday]);
		for (const day of list) {
			expect(keysOf(day)).toEqual(['date', 'note']);
		}

		// A date that is not blocked is a 404. A blocked one answers 200 with the report in the
		// body — not a bare 204.
		const missing = await request.delete(`/api/blocked-days/${saturday}`, {
			headers: BEARER(token)
		});
		expect(missing.status()).toBe(404);

		const removed = await request.delete(`/api/blocked-days/${inset}`, { headers: BEARER(token) });
		expect(removed.status()).toBe(200);
		expect((await removed.json()).atRisk).toEqual([]);

		const remaining = await request.get('/api/blocked-days', { headers: BEARER(token) });
		expect((await remaining.json()).blockedDays.map((d: { date: string }) => d.date)).toEqual([
			bankHoliday
		]);

		const again = await request.delete(`/api/blocked-days/${inset}`, { headers: BEARER(token) });
		expect(again.status()).toBe(404);
	});
});
