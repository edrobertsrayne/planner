import { test, expect, devices, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';

// Runs after the-planning-api/ and before user-settings-password.e2e.ts, for the suite's
// single-worker ordering (see isolation.e2e.ts). Reads the one user and the KS3 Science course
// that earlier files built, and creates nothing.
//
// Touch mode: Playwright's Chromium matches `(pointer: coarse)` as soon as `hasTouch` is true;
// `isMobile` is not needed. Each describe sets its size and pointer with `test.use`.
//
// Playwright counts an element at opacity 0 as visible, so "shown" is asserted on its opacity.
const EMAIL = 'teacher@example.com';
const PASSWORD = 'a-very-long-password';

async function login(page: Page) {
	await page.goto('/login');
	await page.getByLabel('Email').fill(EMAIL);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Log in' }).click();
	await expect(page).toHaveURL('/');
}

async function openCourse(page: Page) {
	await login(page);
	await page.goto('/courses');
	await page.getByRole('link', { name: 'KS3 Science' }).click();
}

test.describe('the tablet layout (touch, about 800×1180)', () => {
	// Pixel Tablet, by hand.
	test.use({ viewport: { width: 800, height: 1180 }, hasTouch: true });

	test('a row control shows without a hover', async ({ page }) => {
		await openCourse(page);
		const pencil = page.getByRole('button', { name: /^Rename / }).first();
		await expect(pencil).toBeVisible();
		await expect(pencil).not.toHaveCSS('opacity', '0');
	});
});

test.describe('the laptop layout (mouse)', () => {
	test.use({ viewport: { width: 1536, height: 750 } });

	test('a row control is hidden until the row is hovered or holds focus', async ({ page }) => {
		await openCourse(page);
		const pencil = page.getByRole('button', { name: /^Rename / }).first();
		await expect(pencil).toHaveCSS('opacity', '0');

		await pencil.focus();
		await expect(pencil).toHaveCSS('opacity', '1');
	});

	test('a row control shows on hover', async ({ page }) => {
		await openCourse(page);
		const pencil = page.getByRole('button', { name: /^Rename / }).first();
		await expect(pencil).toHaveCSS('opacity', '0');

		await pencil.hover({ force: true });
		await expect(pencil).toHaveCSS('opacity', '1');
	});
});

function runFixture(...args: string[]): string {
	return execFileSync('node', ['scripts/e2e-fixtures.ts', ...args], {
		cwd: process.cwd(),
		env: { ...process.env, DATABASE_URL: 'e2e.db' },
		encoding: 'utf-8'
	});
}

// The Lesson editor shows its title as a field on a laptop or tablet, and as a heading on a phone.
async function expectLessonPage(page: Page) {
	await expect(page).toHaveURL(/\/lessons\//);
	await expect(
		page.getByRole('textbox', { name: 'Lesson title' }).or(page.getByRole('heading', { level: 1 }))
	).toBeVisible();
}

// The Lesson editor of Speed by its address: the Courses screen is not usable at every size yet.
async function openLesson(page: Page) {
	await login(page);
	await page.goto(`/lessons/${runFixture('find-lesson-id', 'Speed').trim()}`);
	await expectLessonPage(page);
}

// The Lesson editor of Speed, opened from the Courses screen as Ed opens it.
async function openLessonFromCourses(page: Page) {
	await openCourse(page);
	await page.getByRole('link', { name: 'Forces' }).click();
	await page.getByRole('link', { name: 'Speed', exact: true }).click();
	await expectLessonPage(page);
}

async function expectNoHorizontalScroll(page: Page) {
	const fits = await page.evaluate(
		() => document.documentElement.scrollWidth <= document.documentElement.clientWidth
	);
	expect(fits).toBe(true);
}

test.describe('the App shell on a laptop', () => {
	test.use({ viewport: { width: 1536, height: 750 } });

	test('the Lesson editor fits the width', async ({ page }) => {
		await openLesson(page);
		await expectNoHorizontalScroll(page);
	});

	test('the sidebar names the five screens and holds Settings, theme, Log out and the build line', async ({
		page
	}) => {
		await login(page);
		const nav = page.getByRole('navigation', { name: 'Primary' });
		for (const name of ['Agenda', 'Calendar', 'Classes', 'Courses', 'Planning']) {
			await expect(nav.getByRole('link', { name, exact: true })).toBeVisible();
			await expect(nav.getByRole('link', { name, exact: true })).toHaveText(name);
		}
		const sidebar = page.locator('aside').first();
		await expect(sidebar.getByRole('link', { name: 'Settings' })).toBeVisible();
		await expect(sidebar.getByRole('button', { name: 'Toggle theme' })).toBeVisible();
		await expect(sidebar.getByRole('button', { name: 'Log out' })).toBeVisible();
		await expect(sidebar.getByText(/^Build /)).toBeVisible();
		await expect(page.locator('body > div header')).toBeHidden();
	});

	test('no screen is lit while Settings is open', async ({ page }) => {
		await login(page);
		await page.goto('/settings');
		await expect(
			page.getByRole('navigation', { name: 'Primary' }).locator('[aria-current]')
		).toHaveCount(0);
	});

	test('the window is the only scroller', async ({ page }) => {
		await login(page);
		await page.goto('/calendar');
		const scrollers = await page.evaluate(
			() =>
				[...document.querySelectorAll('main > *')].filter(
					(el) =>
						getComputedStyle(el).overflowY === 'auto' || getComputedStyle(el).overflowY === 'scroll'
				).length
		);
		expect(scrollers).toBe(0);
	});

	test('the Agenda fits the width', async ({ page }) => {
		await login(page);
		await expectNoHorizontalScroll(page);
	});
});

test.describe('the App shell on a tablet in landscape', () => {
	test.use({ viewport: { width: 1280, height: 800 }, hasTouch: true });

	test('the Lesson editor fits the width', async ({ page }) => {
		await openLesson(page);
		await expectNoHorizontalScroll(page);
	});

	test('the Agenda fits the width', async ({ page }) => {
		await login(page);
		await expectNoHorizontalScroll(page);
	});
});

test.describe('the App shell on a tablet in portrait', () => {
	test.use({ viewport: { width: 800, height: 1180 }, hasTouch: true });

	test('the Lesson editor fits the width', async ({ page }) => {
		await openLesson(page);
		await expectNoHorizontalScroll(page);
	});

	test('the sidebar shows icons only, each with a tooltip', async ({ page }) => {
		await login(page);
		const agenda = page.getByRole('navigation', { name: 'Primary' }).getByRole('link', {
			name: 'Agenda'
		});
		await expect(agenda).toBeVisible();
		expect((await agenda.boundingBox())!.width).toBeLessThan(64);
		await agenda.hover();
		await expect(page.locator('[data-slot=tooltip-content]', { hasText: 'Agenda' })).toBeVisible();
	});

	test('the Agenda fits the width', async ({ page }) => {
		await login(page);
		await expectNoHorizontalScroll(page);
	});
});

test.describe('the App shell on a phone', () => {
	// `defaultBrowserType` would force a new worker inside a describe, so take the other fields.
	const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 8'];
	test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

	test('the Lesson editor fits the width', async ({ page }) => {
		await openLesson(page);
		await expectNoHorizontalScroll(page);
	});

	test('the Lesson editor is a read view that steps and writes nothing', async ({ page }) => {
		await openLesson(page);
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Speed');
		await expect(page.getByText('Forces', { exact: true }).first()).toBeVisible();
		await expect(page.getByText(/^(Draft|Planned)$/)).toBeVisible();

		// Nothing on the page takes a write.
		await expect(page.getByRole('textbox')).toHaveCount(0);
		await expect(
			page.getByRole('button', { name: /Delete Lesson|Detach|Add |Remove|^Draft$|^Planned$/ })
		).toHaveCount(0);

		await page.getByRole('button', { name: 'Next Lesson' }).click();
		await expect(page.getByText(/^Lesson 2 of \d+$/)).toBeVisible();
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Motion');
		await page.getByRole('button', { name: 'Previous Lesson' }).click();
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Speed');
		await expectNoHorizontalScroll(page);
	});

	test('the drawer opens from the menu button and goes to the Agenda', async ({ page }) => {
		await login(page);
		await page.goto('/calendar');
		await expect(page.getByRole('link', { name: 'Agenda' })).toBeHidden();

		await page.getByRole('button', { name: 'Menu' }).click();
		const drawer = page.getByRole('dialog');
		await expect(drawer.getByRole('link', { name: 'Courses' })).toBeVisible();
		await expect(drawer.getByRole('link', { name: 'Settings' })).toBeVisible();
		await expect(drawer.getByRole('button', { name: 'Log out' })).toBeVisible();
		await expect(drawer.getByText(/^Build /)).toBeVisible();

		await drawer.getByRole('link', { name: 'Agenda' }).click();
		await expect(page).toHaveURL('/');
		await expect(drawer).toBeHidden();
	});

	test('the Agenda fits the width', async ({ page }) => {
		await login(page);
		await expectNoHorizontalScroll(page);
	});
});

test.describe('the Lesson editor on a laptop', () => {
	test.use({ viewport: { width: 1536, height: 750 } });

	test('Back returns to the screen that opened it, or to the Course page when opened directly', async ({
		page
	}) => {
		await openLessonFromCourses(page);
		const lessonUrl = page.url();
		await page.getByRole('button', { name: 'Back' }).click();
		await expect(page).toHaveURL(/\/courses\?course=.*&topic=/);

		// A full load has no earlier page in the app.
		await page.goto(lessonUrl);
		await page.getByRole('button', { name: 'Back' }).click();
		await expect(page).toHaveURL(/\/courses\?course=.*&topic=/);
		await expect(page.getByRole('link', { name: 'Speed', exact: true })).toBeVisible();
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
		await expect(page).toHaveURL(/\/courses\?course=.*&topic=/);
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

	test('the plan toolbar stays in view while a long plan scrolls', async ({ page }) => {
		await openLessonFromCourses(page);
		const plan = page.getByRole('textbox', { name: 'Notes & objectives' });
		await plan.click();
		await page.keyboard.insertText(Array.from({ length: 60 }, (_, i) => `Line ${i}`).join('\n'));
		await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
		const bold = page.getByRole('button', { name: 'Bold' });
		const box = (await bold.boundingBox())!;
		expect(box.y).toBeGreaterThanOrEqual(0);
		expect(box.y).toBeLessThan(40);

		// Leave the plan as it was for the files that follow.
		await plan.click();
		await page.keyboard.press('Control+a');
		await page.keyboard.press('Delete');
		await page.getByRole('button', { name: 'Back' }).click();
	});
});

test.describe('the Lesson editor for a Standalone Lesson', () => {
	test.use({ viewport: { width: 1536, height: 750 } });

	function standaloneLesson(title: string): string {
		return runFixture('create-standalone-lesson', title).trim();
	}

	async function expectToast(page: Page, fragment: string) {
		await expect(page.locator('[data-sonner-toast]').filter({ hasText: fragment })).toBeVisible();
	}

	test('the form has Draft/Planned, Length and Tags, Links and Attachments, and no Topic, steps or Placements', async ({
		page
	}) => {
		const id = standaloneLesson('Revision carousel');
		await login(page);
		await page.goto(`/lessons/${id}`);
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
		await login(page);
		await page.goto(`/lessons/${id}`);
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
		await login(page);
		await page.goto('/planning');
		await page.getByRole('button', { name: 'Show all' }).click();
		await page.getByRole('link', { name: 'Revision carousel', exact: true }).click();
		await expectLessonPage(page);
		await expect(page.getByText('Standalone Lesson', { exact: true })).toBeVisible();
	});
});

test.describe('Detach on the Lesson editor', () => {
	test.use({ viewport: { width: 1536, height: 750 } });

	test('a Lesson in a Topic shows Detach; after it the same Lesson shows the Standalone Lesson form', async ({
		page
	}) => {
		await openCourse(page);
		await page.getByRole('link', { name: 'Forces' }).click();
		await page.getByPlaceholder('New Lesson title — press Enter').fill('Detachable');
		await page.getByPlaceholder('New Lesson title — press Enter').press('Enter');
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
		await expect(page).toHaveURL(/\/courses\?course=/);
		await expect(page.getByRole('link', { name: 'Detachable' })).toHaveCount(0);
	});
});

// A Session page with a Lesson, opened from the first Agenda row that carries one, the way the
// teacher opens it. Returns the address, so a test can reload it or open it directly.
async function openSessionWithLesson(page: Page): Promise<string> {
	await login(page);
	const row = page
		.locator('li')
		.filter({ has: page.locator('a[href^="/sessions/"]') })
		.filter({ hasNotText: 'Open Slot' })
		.first();
	await row.locator('a[href^="/sessions/"]').first().click();
	await expect(page.getByLabel('How it went')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Open in Lesson editor' })).toBeVisible();
	return new URL(page.url()).pathname;
}

// On touch a control keeps its drawn size and gets its 44 px from an invisible ::after (see
// touch-target.ts), so the box to measure is the larger of the two.
async function expectHitArea44(page: Page, name: string, role: 'button' | 'link') {
	const height = await page
		.getByRole(role, { name })
		.first()
		.evaluate((el) =>
			Math.max(
				el.getBoundingClientRect().height,
				parseFloat(getComputedStyle(el, '::after').height) || 0
			)
		);
	expect(height).toBeGreaterThanOrEqual(44);
}

test.describe('the Session page on a phone', () => {
	const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 8'];
	test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

	test('fits the width, puts the note first once started, and has 44 px targets', async ({
		page
	}) => {
		const path = await openSessionWithLesson(page);
		await expectNoHorizontalScroll(page);

		const date = path.split('/')[3];
		const started = date <= new Date().toISOString().slice(0, 10);
		const note = await page.locator('[data-note]').boundingBox();
		const plan = await page.locator('[data-plan]').boundingBox();
		expect(note && plan && (started ? note.y < plan.y : plan.y < note.y)).toBe(true);

		await expectHitArea44(page, 'Back', 'button');
		await expectHitArea44(page, 'Open in Lesson editor', 'link');
		await expectHitArea44(page, 'Needs more time', 'button');
	});

	test('Open in Lesson editor shows the read view, and Back returns to the Session page', async ({
		page
	}) => {
		const path = await openSessionWithLesson(page);
		await page.getByRole('link', { name: 'Open in Lesson editor' }).click();
		await expectLessonPage(page);
		await expect(page.getByRole('textbox')).toHaveCount(0);
		await expectNoHorizontalScroll(page);

		await page.getByRole('button', { name: 'Back' }).click();
		await expect(page).toHaveURL(path);
		await expect(page.getByLabel('How it went')).toBeVisible();
	});

	test('writes a Session note that a reload keeps', async ({ page }) => {
		await openSessionWithLesson(page);
		const text = `Phone note ${Date.now()}`;
		const field = page.getByLabel('How it went');
		await field.click();
		await field.pressSequentially(text);
		// The note saves on leaving the page, so go Back and return to it.
		await page.getByRole('button', { name: 'Back' }).click();
		await expect(page).toHaveURL('/');
		await page.goForward();
		await page.reload();
		await expect(page.getByLabel('How it went')).toHaveText(text);
	});
});

for (const [name, viewport] of [
	['tablet portrait', { width: 800, height: 1180 }],
	['tablet landscape', { width: 1280, height: 800 }]
] as const) {
	test.describe(`the Session page on a ${name}`, () => {
		test.use({ viewport, hasTouch: true });

		test('fits the width', async ({ page }) => {
			await openSessionWithLesson(page);
			await expectNoHorizontalScroll(page);
		});
	});
}

test.describe('the Session page on a laptop', () => {
	test.use({ viewport: { width: 1536, height: 750 } });

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
