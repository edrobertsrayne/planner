import { test, expect, type Page } from '@playwright/test';
import { isoDate, login, resetTo, runFixture } from './helpers.ts';
import { BEARER, FIXTURE_COURSE, openPage, standingKey } from './the-planning-api/helpers.ts';

// The Sequence tab, By week (the default) and List (`layout=list`). The 9C/Sc1 Class of the standard state gets one Topic of 14
// Lessons ("Move A" to "Move N"), assigned through Assign Topic. 9B/Sc1 has a taught Lesson.
// This file resets the database first, so the files after it start from the standard state.

test.beforeAll(() => resetTo('standard'));

const LETTERS = 'ABCDEFGHIJKLMN'.split('');
const titleOf = (letter: string) => `Move ${letter}`;

let classCId = '';

// The Class page of a Class, on its Sequence tab, as a List.
async function openSequence(page: Page, classId = classCId) {
	await page.goto(`/classes/${classId}?layout=list`);
	await page.getByRole('tab', { name: /^Sequence/ }).click();
	await expect(page.locator('[data-sequence]')).toBeVisible();
}

// The same, By week: the default layout.
async function openWeeks(page: Page, classId = classCId) {
	await page.goto(`/classes/${classId}`);
	await page.getByRole('tab', { name: /^Sequence/ }).click();
	await expect(page.locator('[data-sequence-weeks]')).toBeVisible();
}

const cardOf = (page: Page, title: string) =>
	page
		.locator('[data-lesson-card]')
		.filter({ has: page.locator('[data-title]', { hasText: title }) });

// The titles of the Lessons in the week rows, in Slot order.
const weekOrder = (page: Page) =>
	page.locator('[data-week] [data-lesson-card] [data-title]').allInnerTexts();

// A mouse drag from one Lesson's grip onto another Lesson's Slot, By week. The preview shows
// before the drop, with a dashed outline on each Lesson that will change Slot.
async function weekDrag(page: Page, from: string, onto: string, outlined: number) {
	const grip = await cardOf(page, from)
		.getByRole('button', { name: `Drag ${from}` })
		.boundingBox();
	const target = await cardOf(page, onto).boundingBox();
	if (!grip || !target) throw new Error('No box');
	await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
	await page.mouse.down();
	await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 6 });
	await expect(page.locator('[data-changing]')).toHaveCount(outlined);
	await page.mouse.up();
}

const entries = (page: Page) => page.locator('[data-sequence] > li');

// The titles of the Sequence, in order.
const order = (page: Page) => entries(page).locator('[data-title]').allInnerTexts();
const expected = (letters: string[]) => letters.map(titleOf);

// The centre of a Lesson's card, and of its grip, in the page's own coordinates.
async function centreOf(page: Page, title: string, grip = false) {
	const card = entries(page).filter({ hasText: title });
	const box = await (
		grip ? card.getByRole('button', { name: `Drag ${title}` }) : card
	).boundingBox();
	if (!box) throw new Error(`No box for ${title}`);
	return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// A mouse drag from one Lesson's grip onto another Lesson. The drop line shows before the drop.
async function mouseDrag(page: Page, from: string, onto: string) {
	const start = await centreOf(page, from, true);
	await page.mouse.move(start.x, start.y);
	await page.mouse.down();
	const end = await centreOf(page, onto);
	await page.mouse.move(end.x, end.y, { steps: 6 });
	await expect(page.locator('[data-drop-line]')).toHaveCount(1);
	await page.mouse.up();
}

test.describe.serial('moving Lessons in a Sequence by drag', () => {
	test.use({ viewport: { width: 1180, height: 820 }, hasTouch: true });

	test.beforeAll(async ({ browser }) => {
		const page = await openPage(browser);
		const token = await standingKey(page);
		const courses = await (
			await page.request.get('/api/courses', { headers: BEARER(token) })
		).json();
		const courseId = courses.find((c: { name: string }) => c.name === FIXTURE_COURSE).id;
		const topic = await (
			await page.request.post(`/api/courses/${courseId}/topics`, {
				headers: BEARER(token),
				data: { name: 'Moves' }
			})
		).json();
		for (const letter of LETTERS) {
			const response = await page.request.post(`/api/topics/${topic.id}/lessons`, {
				headers: BEARER(token),
				data: { title: titleOf(letter) }
			});
			expect(response.status()).toBe(201);
		}

		await page.goto('/classes');
		await page
			.getByRole('link', { name: /9C\/Sc1/ })
			.first()
			.click();
		await expect(page).toHaveURL(/\/classes\/[^/]+$/);
		classCId = page.url().split('/').pop()!;
		await page.getByRole('tab', { name: /^Sequence/ }).click();
		await page.getByRole('button', { name: 'Assign Topic' }).click();
		await page.getByRole('menuitem', { name: /^Moves / }).click();
		await expect(page.getByText('Added 14 Lessons from Moves.')).toBeVisible();
		await page.close();
	});

	test('a mouse drag onto another Lesson takes its place, and a drag back undoes it', async ({
		page
	}) => {
		await login(page);
		await openSequence(page);
		expect(await order(page)).toEqual(expected(LETTERS));

		// D takes B's place. B and C move one place down, so those three Lessons change date.
		await mouseDrag(page, titleOf('D'), titleOf('B'));
		await expect(page.locator('[data-move-result]')).toHaveText('3 Lessons change date.');
		expect(await order(page)).toEqual(expected(['A', 'D', 'B', 'C', ...LETTERS.slice(4)]));

		// Each card whose first Slot changed says so, and the moved Lesson has a ring.
		await expect(page.locator('[data-was]')).toHaveCount(3);
		await expect(
			entries(page)
				.filter({ hasText: titleOf('D') })
				.locator('[data-was]')
		).toBeVisible();
		await expect(
			entries(page)
				.filter({ hasText: titleOf('A') })
				.locator('[data-was]')
		).toHaveCount(0);
		await expect(entries(page).filter({ hasText: titleOf('D') })).toHaveClass(/ring-2/);
		await expect(entries(page).filter({ hasText: titleOf('B') })).not.toHaveClass(/ring-2/);

		// The move is kept at once: a reload shows it.
		await openSequence(page);
		expect(await order(page)).toEqual(expected(['A', 'D', 'B', 'C', ...LETTERS.slice(4)]));

		// A drag back is the undo.
		await mouseDrag(page, titleOf('D'), titleOf('C'));
		await expect(page.locator('[data-move-result]')).toHaveText('3 Lessons change date.');
		await expect.poll(() => order(page)).toEqual(expected(LETTERS));
	});

	test('a touch drag from the grip moves a Lesson', async ({ page }) => {
		await login(page);
		await openSequence(page);
		const cdp = await page.context().newCDPSession(page);
		const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x = 0, y = 0) =>
			cdp.send('Input.dispatchTouchEvent', {
				type,
				touchPoints: type === 'touchEnd' ? [] : [{ x, y }]
			});

		const start = await centreOf(page, titleOf('C'), true);
		await touch('touchStart', start.x, start.y);
		const end = await centreOf(page, titleOf('A'));
		for (let step = 1; step <= 6; step++) {
			await touch(
				'touchMove',
				start.x + ((end.x - start.x) * step) / 6,
				start.y + ((end.y - start.y) * step) / 6
			);
		}
		await expect(page.locator('[data-drop-line]')).toHaveCount(1);
		await touch('touchEnd');

		await expect(page.locator('[data-move-result]')).toHaveText('3 Lessons change date.');
		expect(await order(page)).toEqual(expected(['C', 'A', 'B', ...LETTERS.slice(3)]));

		// The drag back, by mouse, puts the Sequence as it was.
		await mouseDrag(page, titleOf('C'), titleOf('B'));
		await expect.poll(() => order(page)).toEqual(expected(LETTERS));
	});

	test('the page scrolls near the bottom edge, and the drop line follows the Lessons under the pointer', async ({
		page
	}) => {
		// A short window, so that the list is taller than the window.
		await page.setViewportSize({ width: 1180, height: 500 });
		await login(page);
		await openSequence(page);
		// Records each Lesson that the drop line sits on, because the line moves faster than a
		// poll can read it.
		await page.evaluate(() => {
			const owners = new Set<string>();
			(window as unknown as { owners: Set<string> }).owners = owners;
			new MutationObserver(() => {
				const title = document
					.querySelector('[data-drop-line]')
					?.closest('li')
					?.querySelector('[data-title]')?.textContent;
				if (title) owners.add(title);
			}).observe(document.querySelector('[data-sequence]')!, { subtree: true, childList: true });
		});
		const start = await centreOf(page, titleOf('A'), true);
		await page.mouse.move(start.x, start.y);
		await page.mouse.down();
		// The pointer stops in the bottom edge zone and does not move again.
		await page.mouse.move(start.x, 480, { steps: 6 });

		await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
		// While the pointer was still, the Lessons that scrolled under it each got the drop line.
		await expect
			.poll(() => page.evaluate(() => (window as unknown as { owners: Set<string> }).owners.size))
			.toBeGreaterThan(3);

		await page.mouse.up();
		await expect.poll(async () => (await order(page)).indexOf(titleOf('A'))).toBeGreaterThan(5);
		expect(await order(page)).toHaveLength(LETTERS.length);

		// Put it back. A taller window shows both Lessons at once.
		await page.setViewportSize({ width: 1180, height: 1400 });
		await mouseDrag(page, titleOf('A'), titleOf('B'));
		await expect.poll(() => order(page)).toEqual(expected(LETTERS));
	});
});

test.describe.serial('the By week layout', () => {
	// Tall, so that every week row is in the window at once.
	test.use({ viewport: { width: 1180, height: 1600 }, hasTouch: true });

	test('is the default, and layout=list picks the List', async ({ page }) => {
		await login(page);
		await openWeeks(page);
		await expect(page.locator('[data-sequence]')).toHaveCount(0);
		await expect(page.locator('[data-week]').first()).toContainText(/Week [AB]/);
		expect(await weekOrder(page)).toEqual(expected(LETTERS));
		// A row of Topic chips, and one line for the other free Slots.
		await expect(page.locator('[data-topic-chip]')).toHaveText(/Moves\s*14/);
		await expect(page.locator('[data-free-after]')).toContainText(
			'other free Slots to the end of the year'
		);
		// Nothing is past the end of the year, and no Lesson is taught.
		await expect(page.locator('[data-past-end]')).toHaveCount(0);
		await expect(page.locator('[data-taught]')).toHaveCount(0);

		await page.goto(`/classes/${classCId}?layout=list`);
		await page.getByRole('tab', { name: /^Sequence/ }).click();
		await expect(page.locator('[data-sequence]')).toBeVisible();
		await expect(page.locator('[data-sequence-weeks]')).toHaveCount(0);
		// The layout button goes back, and the address says so.
		await page.getByRole('button', { name: 'By week' }).click();
		await expect(page.locator('[data-sequence-weeks]')).toBeVisible();
		await expect(page).not.toHaveURL(/layout=/);
	});

	test('a mouse drag takes the target Slot, with a live preview, and a drag back undoes it', async ({
		page
	}) => {
		await login(page);
		await openWeeks(page);

		// D takes B's Slot: B and C go one Slot on, so three Lessons will change Slot.
		await weekDrag(page, titleOf('D'), titleOf('B'), 3);
		await expect(page.locator('[data-move-result]')).toHaveText('3 Lessons change date.');
		expect(await weekOrder(page)).toEqual(expected(['A', 'D', 'B', 'C', ...LETTERS.slice(4)]));
		await expect(page.locator('[data-changing]')).toHaveCount(0);
		await expect(page.locator('[data-was]')).toHaveCount(3);
		await expect(cardOf(page, titleOf('D'))).toHaveClass(/ring-2/);

		// Kept at once: a reload shows it.
		await openWeeks(page);
		expect(await weekOrder(page)).toEqual(expected(['A', 'D', 'B', 'C', ...LETTERS.slice(4)]));

		await weekDrag(page, titleOf('D'), titleOf('C'), 3);
		await expect.poll(() => weekOrder(page)).toEqual(expected(LETTERS));
	});

	test('a touch drag from the grip moves a Lesson, By week', async ({ page }) => {
		await login(page);
		await openWeeks(page);
		const cdp = await page.context().newCDPSession(page);
		const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x = 0, y = 0) =>
			cdp.send('Input.dispatchTouchEvent', {
				type,
				touchPoints: type === 'touchEnd' ? [] : [{ x, y }]
			});

		const grip = await cardOf(page, titleOf('C'))
			.getByRole('button', { name: `Drag ${titleOf('C')}` })
			.boundingBox();
		const target = await cardOf(page, titleOf('A')).boundingBox();
		if (!grip || !target) throw new Error('No box');
		const start = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 };
		const end = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
		await touch('touchStart', start.x, start.y);
		for (let step = 1; step <= 6; step++) {
			await touch(
				'touchMove',
				start.x + ((end.x - start.x) * step) / 6,
				start.y + ((end.y - start.y) * step) / 6
			);
		}
		await expect(page.locator('[data-changing]')).toHaveCount(3);
		await touch('touchEnd');

		await expect(page.locator('[data-move-result]')).toHaveText('3 Lessons change date.');
		expect(await weekOrder(page)).toEqual(expected(['C', 'A', 'B', ...LETTERS.slice(3)]));

		await weekDrag(page, titleOf('C'), titleOf('B'), 3);
		await expect.poll(() => weekOrder(page)).toEqual(expected(LETTERS));
	});
});

test.describe('a taught Lesson is fixed', () => {
	test.use({ viewport: { width: 1180, height: 820 } });

	test('has no grip and takes no drop, and the Lessons after it can move', async ({ page }) => {
		// Move A was taught three days ago on 9C/Sc1.
		const lessonId = runFixture('find-lesson-id', titleOf('A'));
		runFixture('mark-taught', classCId, isoDate(-3), '3', lessonId);
		await login(page);
		await openSequence(page);

		await expect(page.getByRole('button', { name: `Drag ${titleOf('A')}` })).toHaveCount(0);
		await expect(
			entries(page)
				.filter({ hasText: titleOf('A') })
				.getByLabel('Fixed: already taught')
		).toBeVisible();
		await expect(page.getByRole('button', { name: `Drag ${titleOf('B')}` })).toBeVisible();

		// B over A: no drop line, and no move.
		const start = await centreOf(page, titleOf('B'), true);
		await page.mouse.move(start.x, start.y);
		await page.mouse.down();
		const fixed = await centreOf(page, titleOf('A'));
		await page.mouse.move(fixed.x, fixed.y, { steps: 6 });
		await expect(page.locator('[data-drop-line]')).toHaveCount(0);
		await page.mouse.up();
		expect(await order(page)).toEqual(expected(LETTERS));
		await expect(page.locator('[data-move-result]')).toHaveCount(0);

		// B over D: it moves.
		await mouseDrag(page, titleOf('B'), titleOf('D'));
		await expect
			.poll(() => order(page))
			.toEqual(expected(['A', 'C', 'D', 'B', ...LETTERS.slice(4)]));
	});
});

test.describe('a taught Lesson, By week', () => {
	test.use({ viewport: { width: 1180, height: 1600 } });

	test('is hidden behind a line, and is a fixed card with no grip', async ({ page }) => {
		// Move A was marked taught, and B moved, in the test above.
		await login(page);
		await openWeeks(page);

		await expect(page.locator('[data-taught] summary')).toHaveText('1 Lesson taught, fixed — show');
		await expect(page.getByRole('button', { name: `Drag ${titleOf('A')}` })).toHaveCount(0);
		await expect(page.getByRole('button', { name: `Drag ${titleOf('B')}` })).toBeVisible();
		// The test above left B after D.
		expect(await weekOrder(page)).toEqual(expected(['C', 'D', 'B', ...LETTERS.slice(4)]));

		await page.locator('[data-taught] summary').click();
		await expect(page.locator('[data-taught-lesson]')).toContainText(titleOf('A'));
	});
});
