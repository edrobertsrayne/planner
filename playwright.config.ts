import { defineConfig } from '@playwright/test';
import { existsSync } from 'fs';

// Use installed chromium on dev machine
const chromiumPath = existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined;

// A scratch database, never the developer's own local.db (see issue #40). Deleted before every
// run so two consecutive suites see the same fresh state: migrations applied, no user, the
// first-run wizard as the entry gate.
const DATABASE_URL = 'e2e.db';
const ORIGIN = 'http://localhost:4173';

export default defineConfig({
	// One database, one user (ADR-0001) — every spec file mutates the same shared state, so files
	// must run one at a time, in the order they're discovered, rather than racing across workers.
	workers: 1,
	use: {
		launchOptions: chromiumPath ? { executablePath: chromiumPath } : {},
		headless: true
	},
	webServer: {
		command: `rm -f ${DATABASE_URL} ${DATABASE_URL}-shm ${DATABASE_URL}-wal && bun run build && bun run preview`,
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
