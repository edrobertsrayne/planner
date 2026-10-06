import prettier from 'eslint-config-prettier';
import path from 'node:path';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off'
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser
			}
		}
	},
	// svelte/no-navigation-without-resolve wants every internal link built with resolve(). It reads
	// the href where the <a> or the goto() is written, so it can only check a URL that is literal at
	// that point. Everywhere else it is switched off by file, with the reason, rather than by a
	// comment at each line: the reason is a property of the file, and it does not change per link.
	{
		// A URL the teacher typed. It leaves the app, so resolve() must not touch it.
		files: [
			'src/lib/components/session-body.svelte',
			'src/routes/(app)/lessons/*/LinkRow.svelte',
			'src/routes/(app)/lessons/*/+page.svelte'
		],
		rules: {
			'svelte/no-navigation-without-resolve': 'off'
		}
	},
	{
		// Generic primitives. The href is a prop, so the caller resolves it and this file cannot.
		files: [
			'src/lib/components/ui/button/button.svelte',
			'src/lib/components/renameable-row.svelte'
		],
		rules: {
			'svelte/no-navigation-without-resolve': 'off'
		}
	},
	{
		// Navigation helpers. Each is given a URL that is already built — by its caller, or from
		// page.url — so there is nothing here for resolve() to be applied to.
		files: ['src/lib/client/enhance.ts', 'src/lib/client/back.ts'],
		rules: {
			'svelte/no-navigation-without-resolve': 'off'
		}
	},
	{
		// A URL resolved at runtime: sessionHref and courseHref run resolve() inside them, the nav
		// rows' hrefs come from nav.ts, and one address is the browser's own (to.url). The rule
		// reads the href where it is written, so it cannot see through any of them.
		files: [
			'src/routes/(app)/+layout.svelte',
			'src/routes/(app)/+page.svelte',
			'src/routes/(app)/calendar/+page.svelte',
			'src/routes/(app)/classes/*/ClassProgress.svelte',
			'src/routes/(app)/classes/*/NextSessions.svelte',
			'src/routes/(app)/courses/*/+page.svelte',
			'src/routes/(app)/lessons/*/+page.svelte'
		],
		rules: {
			'svelte/no-navigation-without-resolve': 'off'
		}
	},
	{
		// The one {@html} in the app. Its input is markdown-it output produced with `html: false`,
		// so there is no raw HTML in it to sanitise.
		files: ['src/lib/components/markdown.svelte'],
		rules: {
			'svelte/no-at-html-tags': 'off'
		}
	},
	{
		// Override or add rule settings here, such as:
		// 'svelte/button-has-type': 'error'
		rules: {}
	}
);
