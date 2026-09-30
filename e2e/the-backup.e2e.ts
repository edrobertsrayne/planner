import { test, expect, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Runs after the-attachments.e2e.ts — the one user, the KS3 Science course and its Attachments
// exist — and before the-calendar-setup.e2e.ts. The suite's server is instance A. This file starts
// a second, empty planner (instance B) from the same build on its own port and folder, because a
// Restore needs an empty instance and the suite shares one database. B runs the built adapter with
// the container's BODY_SIZE_LIMIT, which `bun run preview` never exercises.
const EMAIL = 'teacher@example.com';
const PASSWORD = 'a-very-long-password';
const B = 'http://127.0.0.1:4174';
const MB = 1024 * 1024;

let instanceB: ChildProcess;
let folder: string;

async function login(page: Page, origin: string) {
	await page.goto(`${origin}/login`);
	await page.getByLabel('Email').fill(EMAIL);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Log in' }).click();
	await expect(page).toHaveURL(`${origin}/`);
}

async function startB() {
	folder = mkdtempSync(join(tmpdir(), 'planner-restore-'));
	mkdirSync(join(folder, 'data'));
	instanceB = spawn('bun', ['--bun', 'build/index.js'], {
		env: {
			...process.env,
			PORT: '4174',
			DATABASE_URL: join(folder, 'data', 'planner.db'),
			ORIGIN: B,
			BETTER_AUTH_URL: B,
			BETTER_AUTH_SECRET: 'e2e-instance-b-secret-not-used-outside-tests',
			BODY_SIZE_LIMIT: '100G'
		},
		stdio: 'ignore'
	});
	await expect
		.poll(
			() =>
				fetch(`${B}/setup`).then(
					(r) => r.ok,
					() => false
				),
			{ timeout: 30_000 }
		)
		.toBe(true);
}

test.describe.serial('Back up and Restore', () => {
	let page: Page;
	let backup: Buffer;
	let apiKey: string;

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		await startB();
	});

	test.afterAll(async () => {
		instanceB?.kill();
		rmSync(folder, { recursive: true, force: true });
		await page.close();
	});

	test('Settings warns that the Backup is secret and shows its expected size', async () => {
		await login(page, 'http://localhost:4173');
		await page.goto('/settings');

		await expect(page.getByText(/Expected size: up to/)).toBeVisible();
		await expect(page.getByText(/holds your login and API key/)).toBeVisible();
		apiKey = await page.getByLabel('API key').inputValue();
	});

	test('Back up downloads one file', async () => {
		const download = page.waitForEvent('download');
		await page.getByRole('link', { name: 'Back up' }).click();
		const file = await download;

		expect(file.suggestedFilename()).toMatch(/^planner-backup-\d{4}-\d{2}-\d{2}\.tar$/);
		backup = readFileSync((await file.path())!);
		expect(backup.length).toBeGreaterThan(0);
	});

	test('a file that is not a Backup, and a truncated Backup, are refused and leave B empty', async () => {
		const bad = join(folder, 'notes.tar');
		const truncated = join(folder, 'truncated.tar');
		writeFileSync(bad, 'these are not planner data'.repeat(50));
		writeFileSync(truncated, backup.subarray(0, backup.length - 2000));

		await page.goto(`${B}/setup`);
		for (const file of [bad, truncated]) {
			await page.getByLabel('Backup file').setInputFiles(file);
			await page.getByRole('button', { name: 'Restore', exact: true }).click();
			await expect(page.getByRole('alert')).toContainText('not a Backup');
			expect(readdirSync(join(folder, 'data')).filter((name) => name.startsWith('.'))).toEqual([]);
			await page.goto(`${B}/setup`);
			await expect(page.getByText('Set up Planner', { exact: true })).toBeVisible();
		}
	});

	test('Restoring into B recreates A: the same records, Attachments and API key', async () => {
		await page.getByLabel('Backup file').setInputFiles({
			name: 'planner-backup.tar',
			mimeType: 'application/x-tar',
			buffer: backup
		});
		await page.getByRole('button', { name: 'Restore', exact: true }).click();
		await expect(page).toHaveURL(`${B}/login`);

		await login(page, B);
		await page.goto(`${B}/courses`);
		await expect(page.getByRole('link', { name: 'KS3 Science' })).toBeVisible();

		const asKey = { headers: { Authorization: `Bearer ${apiKey}` } };
		const [a, b] = await Promise.all([
			page.request.get('http://localhost:4173/api/courses', asKey),
			page.request.get(`${B}/api/courses`, asKey)
		]);
		expect(b.status()).toBe(200);
		expect(await b.json()).toEqual(await a.json());

		const ids = readdirSync('attachments');
		expect(ids.length).toBeGreaterThan(1);
		for (const id of ids) {
			const download = await page.request.get(`${B}/attachments/${id}`);
			expect(download.status()).toBe(200);
			expect(Buffer.compare(await download.body(), readFileSync(join('attachments', id)))).toBe(0);
		}
	});

	test('once B has a user, the Restore choice is gone and its route refuses', async () => {
		const other = await page.context().browser()!.newPage();
		await other.goto(`${B}/setup`);
		await expect(other).toHaveURL(`${B}/login`);
		await other.close();

		const attempt = await page.request.post(`${B}/setup/restore`, {
			data: backup,
			maxRedirects: 0
		});
		expect(attempt.status()).toBe(303);
	});

	test('other routes still refuse a body over 12 MB', async ({ request }) => {
		const response = await request.post(`${B}/login`, {
			data: Buffer.alloc(13 * MB),
			headers: { 'Content-Type': 'application/octet-stream' }
		});
		expect(response.status()).toBe(413);
	});
});
