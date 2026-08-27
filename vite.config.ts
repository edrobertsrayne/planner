import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import adapter from 'svelte-adapter-bun';
import { sveltekit } from '@sveltejs/kit/vite';

// Unit tests must not depend on a developer's .env or shell exports. These defaults sit above the
// plugin call because the SvelteKit plugin bakes $env/dynamic/private into test modules when it
// resolves the config. ??= leaves dev and build untouched and lets a deliberate override win.
if (process.env.VITEST) {
	process.env.DATABASE_URL ??= ':memory:';
	process.env.ORIGIN ??= 'http://localhost:5173';
	process.env.BETTER_AUTH_URL ??= 'http://localhost:5173';
	process.env.BETTER_AUTH_SECRET ??= 'vitest-suite-secret-not-used-outside-tests';
}

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			adapter: adapter(),

			typescript: {
				config: (config) => {
					config.include.push('../drizzle.config.ts', '../scripts/**/*.ts');
				}
			}
		})
	],
	ssr: {
		external: ['bun:sqlite'],
		noExternal: ['zod']
	},
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					// Every test file opens its own throwaway in-memory database (DATABASE_URL defaults at
					// the top of this file), so nothing races a shared file. Kept on as cheap insurance;
					// turning it off is untested.
					fileParallelism: false,
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
