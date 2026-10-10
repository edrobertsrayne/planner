import { defineConfig } from '@playwright/test';
import { DATABASE_URL, ORIGIN } from './e2e/helpers.ts';
import { existsSync } from 'fs';

// Use installed chromium on dev machine
const chromiumPath = existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined;

export default defineConfig({
	// One server and one database file (ADR-0001), so files run one at a time. Each file resets
	// the database first (`resetTo` in e2e/helpers.ts), so any file also runs alone.
	workers: 1,
	use: {
		launchOptions: chromiumPath ? { executablePath: chromiumPath } : {},
		headless: true,
		// A failed test leaves a trace to read (DOM snapshots, network, action timeline) in test-results/.
		// The trace has no screenshot filmstrip: recording screenshots for every test slowed the suite.
		// Traces for passing tests are deleted. No retries: a flake reports itself.
		trace: { mode: 'retain-on-failure', screenshots: false }
	},
	webServer: {
		// The scratch database and its attachment files are deleted before every run, so two
		// consecutive suites see the same fresh state.
		command: `rm -f ${DATABASE_URL} ${DATABASE_URL}-shm ${DATABASE_URL}-wal && rm -rf attachments && bun run build && bun run preview`,
		port: 4173,
		// Never reuse a server already on this port — that could be the developer's own `bun run
		// preview`, serving local.db, which is exactly what this file exists to keep the suite off.
		reuseExistingServer: false,
		timeout: 120_000,
		env: {
			DATABASE_URL,
			ORIGIN,
			BETTER_AUTH_URL: ORIGIN,
			BETTER_AUTH_SECRET: 'e2e-suite-secret-fixed-value-not-used-outside-tests'
		}
	},
	testMatch: '**/*.e2e.{ts,js}'
});
