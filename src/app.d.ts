import type { User, Session } from 'better-auth';

// Baked in at build time by vite.config.ts (see buildInfo there).
declare global {
	const __APP_BUILD_SHA__: string;
	const __APP_BUILD_DATE__: string;

	// See https://svelte.dev/docs/kit/types#app.d.ts
	// for information about these interfaces
	namespace App {
		interface Locals {
			user?: User;
			session?: Session;
			apiKeyId?: string;
		}

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
