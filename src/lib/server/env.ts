// Server env access for the optional integrations (OpenRouter titles, GitHub feedback).
//
// SvelteKit loads `.env` into `$env/*`, not into `process.env` under `vite dev`. Reading
// `process.env` directly therefore misses a local `.env`, so read through `getServerEnv`:
// `$env/dynamic/private` first (dev `.env` and the runtime), `process.env` as a fallback.
//
// Tests pin values with `setEnvForTests` / `clearEnvForTests`, so a contract test never reads the
// developer's real `.env`.

import { env } from '$env/dynamic/private';

export type ServerEnvName = 'OPENROUTER_API_KEY' | 'OPENROUTER_MODEL' | 'GITHUB_FEEDBACK_TOKEN';

let testOverrides: Partial<Record<ServerEnvName, string>> = {};

/** Trimmed value of `name`, or `''` when unset. */
export function getServerEnv(name: ServerEnvName): string {
	const pinned = testOverrides[name];
	if (pinned !== undefined) return pinned.trim();
	const fromDynamic = env[name]?.trim();
	if (fromDynamic) return fromDynamic;
	return process.env[name]?.trim() ?? '';
}

/** Test seam: pin `name` (use `''` to simulate unset). */
export function setEnvForTests(name: ServerEnvName, value: string): void {
	testOverrides[name] = value;
}

/** Test seam: release every pinned value back to the real environment. */
export function clearEnvForTests(): void {
	testOverrides = {};
}
