import { test, expect, type Page } from '@playwright/test';
import {
	expectLessonPage,
	expectNoHorizontalScroll,
	login,
	openCourse,
	openSessionWithLesson,
	resetTo,
	runFixture
} from './helpers.ts';

test.beforeAll(() => resetTo('standard'));

// Every screen fits the width at each size that writes: no screen scrolls sideways. One test per
// size walks all the screens, so the check costs one login a size. The phone checks stay in each
// screen's own layout file, beside what the phone hides. Touch mode: Playwright's Chromium matches
// `(pointer: coarse)` as soon as `hasTouch` is true.
const screens: [string, (page: Page) => Promise<void>][] = [
	[
		'the Agenda',
		async (page) => {
			await page.goto('/');
			await expect(page.getByRole('heading', { level: 1, name: 'Agenda' })).toBeAttached();
		}
	],
	[
		'the Calendar',
		async (page) => {
			await page.goto('/calendar');
			await expect(page.locator('main table')).toBeVisible();
		}
	],
	[
		'the Planning table',
		async (page) => {
			await page.goto('/planning');
			await expect(page.getByRole('link', { name: 'Speed', exact: true })).toBeVisible();
		}
	],
	[
		'the Courses screen',
		async (page) => {
			await page.goto('/courses');
			await expect(page.getByRole('link', { name: /KS3 Science/ })).toBeVisible();
		}
	],
	['the Course page', openCourse],
	[
		'the Classes screen',
		async (page) => {
			await page.goto('/classes');
			await expect(page.getByRole('link', { name: /9B\/Sc1/ })).toBeVisible();
		}
	],
	[
		'the Class page',
		async (page) => {
			await page.goto(`/classes/${runFixture('find-class-id', '9B/Sc1').trim()}`);
			await expect(page.getByRole('heading', { level: 1, name: '9B/Sc1' })).toBeVisible();
		}
	],
	[
		'the Lesson editor',
		async (page) => {
			await page.goto(`/lessons/${runFixture('find-lesson-id', 'Speed').trim()}`);
			await expectLessonPage(page);
		}
	],
	['the Session page', async (page) => void (await openSessionWithLesson(page))],
	[
		'Settings',
		async (page) => {
			await page.goto('/settings');
			await expect(page.getByLabel('API key')).toBeVisible();
		}
	]
];

for (const [name, use] of [
	['laptop', { viewport: { width: 1280, height: 720 } }],
	['tablet portrait', { viewport: { width: 800, height: 1180 }, hasTouch: true }],
	['tablet landscape', { viewport: { width: 1280, height: 800 }, hasTouch: true }]
] as const) {
	test.describe(`on a ${name}`, () => {
		test.use(use);

		test('every screen fits the width', async ({ page }) => {
			await login(page);
			for (const [screen, open] of screens) {
				await test.step(screen, async () => {
					await open(page);
					await expectNoHorizontalScroll(page);
				});
			}
		});
	});
}
