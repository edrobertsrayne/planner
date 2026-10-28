import type { User } from 'better-auth';
import type { Zone } from '$lib/server/zone';

// Baked in at build time by vite.config.ts (see buildInfo there).
declare global {
	const __APP_BUILD_SHA__: string;
	const __APP_BUILD_DATE__: string;

	// See https://svelte.dev/docs/kit/types#app.d.ts
	// for information about these interfaces
	namespace App {
		interface Locals {
			user?: User;
			/** Which part of the app the request belongs to; set once by `handleZone`. */
			zone: Zone;
		}

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
