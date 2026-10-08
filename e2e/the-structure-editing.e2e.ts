import { test, expect } from '@playwright/test';
import {
	expectLessonPage,
	expectToast,
	login,
	openCourse,
	openLesson,
	openLessonFromCourses,
	openSessionWithLesson,
	isoDate,
	runFixture,
	todayIso
} from './helpers.ts';

// The structure-editing tests of the responsive work (issue #320): the Course, Topic and Lesson
// editors and the Session page, at a laptop size, with writes. Runs after
// the-responsive-layouts.e2e.ts and before user-settings-password.e2e.ts, for the suite's
// single-worker ordering (see isolation.e2e.ts). Reads the one user, the KS3 Science course and
// the Classes earlier files built; leaves `Revision carousel` (with its Tag, Link and
// Attachment) behind, and undoes everything else it makes.

test.describe('the Course and Topic editors', () => {
	test.use({ viewport: { width: 1280, height: 720 } });

	test('a long Topic title wraps in full, and Delete Topic asks before it deletes', async ({
		page
	}) => {
		await openCourse(page);
		const title = 'A very long Topic title that has to wrap inside the narrow column of Topics';
		const box = page.getByPlaceholder('New Topic name — press Enter');
		await box.fill(title);
		await box.press('Enter');
		const link = page.getByRole('link', { name: title });
		await expect(link).toBeVisible();
		expect(await link.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);

		await page.getByRole('button', { name: 'Topic actions' }).click();
		await page.getByRole('menuitem', { name: 'Delete Topic' }).click();
		await page.getByRole('button', { name: 'Cancel' }).click();
		await expect(link).toBeVisible();

		await page.getByRole('button', { name: 'Topic actions' }).click();
		await page.getByRole('menuitem', { name: 'Delete Topic' }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
		await expect(link).toHaveCount(0);
	});

	test('Delete Course asks before it deletes, and a Course with Classes refuses', async ({
		page
	}) => {
		await openCourse(page);
		await page.getByRole('button', { name: 'Course actions' }).click();
		await page.getByRole('menuitem', { name: 'Delete Course' }).click();
		await page.getByRole('button', { name: 'Cancel' }).click();
		await expect(page.getByRole('heading', { level: 1, name: 'KS3 Science' })).toBeVisible();

		await page.getByRole('button', { name: 'Course actions' }).click();
		await page.getByRole('menuitem', { name: 'Delete Course' }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
		await expect(page.getByRole('alert')).toContainText('A Class follows this Course');
	});
});

test.describe('the Lesson editor on a laptop', () => {
	test.use({ viewport: { width: 1280, height: 720 } });

	test('Back returns to the screen that opened it, or to the Course page when opened directly', async ({
		page
	}) => {
		await openLessonFromCourses(page);
		const lessonUrl = page.url();
		await page.getByRole('button', { name: 'Back' }).click();
		await expect(page).toHaveURL(/\/courses\/[^/?]+\?topic=/);

		// A full load has no earlier page in the app.
		await page.goto(lessonUrl);
		await page.getByRole('button', { name: 'Back' }).click();
		await expect(page).toHaveURL(/\/courses\/[^/?]+\?topic=/);
		await expect(page.getByRole('link', { name: 'Speed', exact: true })).toBeVisible();
	});

	test('a refused save names its reason on the page', async ({ page }) => {
		// The save writes on blur and returns its refusal on `form`; the page must show it
		// (the deleted Courses pane did).
		await openLessonFromCourses(page);
		const title = page.getByRole('textbox', { name: 'Lesson title' });
		// Spaces pass the browser's required check; the server refuses them.
		await title.fill('   ');
		await title.blur();
		await expect(page.getByRole('alert')).toContainText('A Lesson needs a title.');
	});

	test('stepping from a directly-opened Lesson keeps Back on the fallback', async ({ page }) => {
		// A full load has no in-app page behind it, and a same-route step must not tell Back
		// otherwise: history.back() would leave the app or do nothing.
		await openLesson(page);
		await page.getByRole('button', { name: 'Next Lesson' }).click();
		await expect(page.getByRole('textbox', { name: 'Lesson title' })).toHaveValue('Motion');
		await page.getByRole('button', { name: 'Back' }).click();
		await expect(page).toHaveURL(/\/courses\/[^/?]+\?topic=/);
	});

	test('the page bar steps through the Topic with the controls and [ ]', async ({ page }) => {
		await openLessonFromCourses(page);
		const previous = page.getByRole('button', { name: 'Previous Lesson' });
		const next = page.getByRole('button', { name: 'Next Lesson' });
		await expect(page.getByText(/^Lesson 1 of \d+$/)).toBeVisible();
		await expect(previous).toBeDisabled();
		await expect(next).toBeEnabled();

		// Stepping replaces the history entry: two steps, one Back out.
		await next.click();
		await expect(page.getByText(/^Lesson 2 of \d+$/)).toBeVisible();
		await expect(page.getByRole('textbox', { name: 'Lesson title' })).toHaveValue('Motion');
		await page.keyboard.press('[');
		await expect(page.getByText(/^Lesson 1 of \d+$/)).toBeVisible();
		await page.keyboard.press(']');
		await expect(page.getByText(/^Lesson 2 of \d+$/)).toBeVisible();

		// The last Lesson has no next, and `]` there does nothing.
		while (await next.isEnabled()) await page.keyboard.press(']');
		const last = await page.getByText(/^Lesson \d+ of \d+$/).innerText();
		expect(last).toMatch(/^Lesson (\d+) of \1$/);
		await page.keyboard.press(']');
		await expect(page.getByText(last)).toBeVisible();

		// A field with focus keeps the keys.
		const title = page.getByRole('textbox', { name: 'Lesson title' });
		const typed = await title.inputValue();
		await title.click();
		await page.keyboard.press('[');
		await expect(title).toHaveValue(`${typed}[`);
		await title.fill(typed);
		await title.blur();

		await page.getByRole('button', { name: 'Back' }).click();
		await expect(page).toHaveURL(/\/courses\/[^/?]+\?topic=/);
	});

	test('a title edit followed at once by the breadcrumb is saved', async ({ page }) => {
		await openLessonFromCourses(page);
		const title = page.getByRole('textbox', { name: 'Lesson title' });
		await title.fill('Speed up');
		await page.getByRole('link', { name: /KS3 Science/ }).click();
		await expect(page.getByRole('link', { name: 'Speed up', exact: true })).toBeVisible();

		// Put the title back for the files that follow.
		await page.getByRole('link', { name: 'Speed up', exact: true }).click();
		await page.getByRole('textbox', { name: 'Lesson title' }).fill('Speed');
		await page.getByRole('button', { name: 'Back' }).click();
		await expect(page.getByRole('link', { name: 'Speed', exact: true })).toBeVisible();
	});

	test('a Topic move keeps the page and the breadcrumb follows the new Topic', async ({ page }) => {
		await openLessonFromCourses(page);
		const url = page.url();
		const breadcrumb = page.getByRole('link', { name: /KS3 Science/ });
		await page.getByLabel('Topic', { exact: true }).selectOption({ label: 'Materials' });
		await expect(breadcrumb).toContainText('Materials');
		expect(page.url()).toBe(url);

		await page.getByLabel('Topic', { exact: true }).selectOption({ label: 'Forces' });
		await expect(breadcrumb).toContainText('Forces');
	});
});

test.describe('the Lesson editor for a Standalone Lesson', () => {
	test.use({ viewport: { width: 1280, height: 720 } });

	function standaloneLesson(title: string): string {
		return runFixture('create-standalone-lesson', title).trim();
	}

	test('the form has Draft/Planned, Length and Tags, Links and Attachments, and no Topic, steps or Placements', async ({
		page
	}) => {
		const id = standaloneLesson('Revision carousel');
		await login(page, `/lessons/${id}`);
		await expectLessonPage(page);

		await expect(page.getByText('Standalone Lesson', { exact: true })).toBeVisible();
		await expect(page.getByRole('radio', { name: 'Planned' })).toBeVisible();
		await expect(page.getByLabel('Length')).toBeVisible();
		await expect(page.getByLabel('Topic', { exact: true })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Next Lesson' })).toHaveCount(0);
		await expect(page.getByText(/^Lesson \d+ of \d+$/)).toHaveCount(0);

		await page.getByRole('button', { name: '+ Add Tag' }).click();
		await page.getByPlaceholder('Tag name').fill('revision');
		await page.getByRole('button', { name: 'Add', exact: true }).click();
		await expect(page.getByRole('button', { name: 'Remove revision' })).toBeVisible();

		await page.getByRole('button', { name: '+ Add Link' }).click();
		await page.getByPlaceholder('Label').fill('Past papers');
		await page.getByPlaceholder('https://…').fill('https://example.com/papers');
		await page.getByRole('button', { name: 'Add', exact: true }).click();
		await expect(page.getByRole('link', { name: 'Past papers' })).toBeVisible();

		await page.getByLabel('Choose a file to attach').setInputFiles({
			name: 'carousel.txt',
			mimeType: 'text/plain',
			buffer: Buffer.from('stations')
		});
		await expect(page.locator('main').getByText('carousel.txt')).toBeVisible();

		// Opened directly, Back goes to Planning.
		await page.getByRole('button', { name: 'Back' }).click();
		await expect(page).toHaveURL(/\/planning$/);
	});

	test('Delete on a placed Standalone Lesson shows the refusal and keeps it; an unplaced one is deleted', async ({
		page
	}) => {
		const id = standaloneLesson('Placed carousel');
		const date = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
		runFixture('place-lesson', id, '9C/Sc1', date);
		await login(page, `/lessons/${id}`);
		await expectLessonPage(page);

		await page.getByRole('button', { name: 'Delete Lesson' }).click();
		await expectToast(page, 'A Placement names this Lesson');
		await expect(page).toHaveURL(`/lessons/${id}`);

		// Every Lesson title on Planning opens the Lesson editor, a placed Standalone one too.
		await page.goto('/planning');
		await page.getByRole('link', { name: 'Placed carousel', exact: true }).click();
		await expect(page).toHaveURL(`/lessons/${id}`);

		runFixture('unplace-lesson', id);
		await page.reload();
		await page.getByRole('button', { name: 'Delete Lesson' }).click();
		await expect(page).toHaveURL(/\/planning$/);
		await expect(page.getByRole('link', { name: 'Placed carousel' })).toHaveCount(0);
	});

	test('an unplaced Standalone Lesson on Planning opens the Lesson editor', async ({ page }) => {
		standaloneLesson('Planning carousel');
		await login(page, '/planning');
		await page.getByRole('link', { name: 'Planning carousel', exact: true }).click();
		await expectLessonPage(page);
		await expect(page.getByText('Standalone Lesson', { exact: true })).toBeVisible();

		// Delete it, so nothing lasts.
		await page.getByRole('button', { name: 'Delete Lesson' }).click();
		await expect(page).toHaveURL(/\/planning$/);
	});
});

test.describe('Detach on the Lesson editor', () => {
	test.use({ viewport: { width: 1280, height: 720 } });

	test('a Lesson in a Topic shows Detach; after it the same Lesson shows the Standalone Lesson form', async ({
		page
	}) => {
		await openCourse(page);
		await page.getByRole('link', { name: 'Forces' }).click();
		await page.getByPlaceholder('New Lesson title — press Enter').fill('Detachable');
		await page.getByPlaceholder('New Lesson title — press Enter').press('Enter');
		// Creating a Lesson neither opens it nor takes the caret out of the box.
		await expect(page.getByRole('link', { name: 'Detachable', exact: true })).toBeVisible();
		await expect(page).toHaveURL(/\/courses\/[^/?]+\?topic=/);
		await expect(page.getByPlaceholder('New Lesson title — press Enter')).toBeFocused();
		await page.getByRole('link', { name: 'Detachable', exact: true }).click();
		await expectLessonPage(page);
		const url = page.url();
		await expect(page.getByLabel('Topic', { exact: true })).toBeVisible();

		await page.getByRole('button', { name: 'Detach from Topic' }).click();
		await expect(
			page.locator('[data-sonner-toast]').filter({ hasText: 'Lesson detached from its Topic.' })
		).toBeVisible();
		expect(page.url()).toBe(url);
		await expect(page.getByRole('textbox', { name: 'Lesson title' })).toHaveValue('Detachable');
		await expect(page.getByText('Standalone Lesson', { exact: true })).toBeVisible();
		await expect(page.getByLabel('Topic', { exact: true })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Detach from Topic' })).toHaveCount(0);

		// Leave nothing behind for the files that follow. It was opened from the Courses screen,
		// so Back after the delete returns there.
		await page.getByRole('button', { name: 'Delete Lesson' }).click();
		await expect(page).toHaveURL(/\/courses\/[^/?]+\?topic=/);
		await expect(page.getByRole('link', { name: 'Detachable' })).toHaveCount(0);
	});
});

test.describe('the Session page on a laptop', () => {
	test.use({ viewport: { width: 1280, height: 720 } });

	test('a reload keeps it, Back with nothing behind goes to the Agenda, and the Lesson editor opens', async ({
		page
	}) => {
		const path = await openSessionWithLesson(page);
		await page.reload();
		await expect(page).toHaveURL(path);
		await expect(page.getByLabel('How it went')).toBeVisible();

		await page.getByRole('link', { name: 'Open in Lesson editor' }).click();
		await expectLessonPage(page);
		await page.getByRole('button', { name: 'Back' }).click();
		await expect(page).toHaveURL(path);

		await page.getByRole('link', { name: 'Open in Lesson editor' }).click();
		await expectLessonPage(page);

		// Opened directly there is no page behind it.
		await page.goto(path);
		await page.getByRole('button', { name: 'Back' }).click();
		await expect(page).toHaveURL('/');
	});
});

test.describe('Continuations on the Session page', () => {
	test.use({ viewport: { width: 1280, height: 720 } });

	test('Needs more time confirms and counts each click, and Remove one undoes it', async ({
		page
	}) => {
		await login(page);
		// A started Session is not on the Agenda every run date: 9B/Sc1 teaches Mon, Wed and Fri P1
		// and 9C/Sc1 Tuesday P3, so on a Thursday or a weekend no row ahead is dated today or earlier.
		// Record one in the past seven days — scripts/e2e-fixtures.ts writes what the app has no way
		// to make — and take it from the look-back, where the teacher opens a past Session. P6 is a
		// Period 9B/Sc1 never holds, so the row can never collide with a scheduled one; teaching-flows
		// writes its past Session the same way.
		const classAId = runFixture('find-class-id', '9B/Sc1').trim();
		runFixture(
			'mark-taught',
			classAId,
			isoDate(-1),
			'6',
			runFixture('find-lesson-id', 'Speed').trim()
		);
		await page.goto('/?past=1');
		const hrefs = await page
			.locator('li')
			.filter({ hasNotText: 'Open Slot' })
			.locator('a[href^="/sessions/"]')
			.evaluateAll((links) => links.map((a) => a.getAttribute('href')!));
		const started = hrefs.find((href) => href.split('/')[3] <= todayIso());
		expect(started, 'the look-back holds a started Session with a Lesson').toBeDefined();
		await page.goto(started!);

		const status = page.getByRole('status').filter({ hasText: /^Continued onto/ });
		const more = page.getByRole('button', { name: 'Needs more time' });
		await expect(status).toHaveCount(0);

		await more.click();
		await expectToast(page, 'Lesson continued onto the next Available Slot.');
		await expect(status).toHaveText('Continued onto 1 more Session.');
		await more.click();
		await expect(status).toHaveText('Continued onto 2 more Sessions.');

		const remove = page.getByRole('button', { name: 'Remove one' });
		await remove.click();
		await expectToast(page, 'Continuation removed.');
		await expect(status).toHaveText('Continued onto 1 more Session.');
		await remove.click();
		await expect(status).toHaveCount(0);
		await expect(remove).toHaveCount(0);
		runFixture('unmark-taught', classAId, isoDate(-1), '6');
	});
});

test.describe('the Planning table', () => {
	test.use({ viewport: { width: 1280, height: 560 } });

	test('a click beside the Draft/Planned toggle opens nothing; the title opens the Lesson', async ({
		page
	}) => {
		await login(page, '/planning');
		const row = page
			.getByRole('row')
			.filter({ has: page.getByRole('link', { name: 'Speed', exact: true }) })
			.first();
		// The corner of the Status cell is beside the toggle and on no control.
		await row
			.getByRole('cell')
			.last()
			.click({ position: { x: 2, y: 2 } });
		await expect(page).toHaveURL(/\/planning/);
		await expect(row).toBeVisible();
		await row.getByRole('link', { name: 'Speed', exact: true }).click();
		await expectLessonPage(page);
	});
});
