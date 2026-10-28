// Captures a page in light and dark mode for a PR body.
// Usage: bun .agents/skills/pr/screenshot.mjs <url> <out-dir> <name>
// Writes <out-dir>/<name>-light.png and <out-dir>/<name>-dark.png.
// Logs in as the demo user (see the demo-db skill) when the app redirects to /login.
// Set CHROMIUM_PATH to use a Chromium other than Playwright's own download.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { EMAIL, PASSWORD } from '../../../e2e/helpers.ts';

const [url, outDir, name] = process.argv.slice(2);
if (!url || !outDir || !name) {
	console.error('Usage: bun .agents/skills/pr/screenshot.mjs <url> <out-dir> <name>');
	process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
try {
	for (const colorScheme of ['light', 'dark']) {
		// mode-watcher follows the system preference until the user picks a theme,
		// so a fresh context's colorScheme decides which theme renders.
		const page = await browser.newPage({ colorScheme, viewport: { width: 1280, height: 800 } });
		let response = await page.goto(url, { waitUntil: 'networkidle' });
		if (new URL(page.url()).pathname === '/login') {
			await page.getByLabel('Email').fill(EMAIL);
			await page.getByLabel('Password').fill(PASSWORD);
			await page.getByRole('button', { name: 'Log in' }).click();
			await page.waitForURL((u) => u.pathname !== '/login');
			response = await page.goto(url, { waitUntil: 'networkidle' });
		}
		if (!response?.ok()) throw new Error(`${url} returned ${response?.status()}`);
		const file = join(outDir, `${name}-${colorScheme}.png`);
		await page.screenshot({ path: file, fullPage: true });
		console.log(file);
		await page.close();
	}
} finally {
	await browser.close();
}
