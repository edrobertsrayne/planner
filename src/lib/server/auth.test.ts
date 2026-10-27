import { env } from '$env/dynamic/private';
import { serializeSignedCookie } from 'better-call';
import { beforeEach, describe, expect, test } from 'vitest';
import { auth, assertOriginMatchesAuthUrl, MIN_PASSWORD_LENGTH } from './auth';
import { createFirstUser, hasUser } from './setup';

const PASSWORD = 'a-very-long-password';

// The real endpoint, not `auth.api`: the rule being tested is enforced by the route, so the route
// is what the test calls. `auth.handler` needs no server and no request context of its own.
function post(path: string, body: unknown, cookie?: string) {
	const origin = env.BETTER_AUTH_URL ?? '';
	return auth.handler(
		new Request(`${origin}${path}`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				origin,
				...(cookie ? { cookie } : {})
			},
			body: JSON.stringify(body)
		})
	);
}

beforeEach(async () => {
	const ctx = await auth.$context;
	for (const user of await ctx.internalAdapter.listUsers())
		await ctx.internalAdapter.deleteUser(user.id);
});

// The public sign-in endpoint is closed (ADR-0011), so the test signs in the way the app's form
// action does — a session row, and the cookie better-auth signs for it — rather than through the
// route it is testing.
async function signInCookie(email: string) {
	const ctx = await auth.$context;
	const found = await ctx.internalAdapter.findUserByEmail(email);
	if (!found) throw new Error(`No user ${email}`);
	const session = await ctx.internalAdapter.createSession(found.user.id);
	const serialized = await serializeSignedCookie(
		ctx.authCookies.sessionToken.name,
		session.token,
		ctx.secret
	);
	return serialized.split(';')[0];
}

describe('assertOriginMatchesAuthUrl', () => {
	test('refuses to start when ORIGIN and BETTER_AUTH_URL disagree, naming both', () => {
		expect(() =>
			assertOriginMatchesAuthUrl('https://planner.greensroad.uk', 'http://localhost:5173')
		).toThrow(
			/ORIGIN.*https:\/\/planner\.greensroad\.uk.*BETTER_AUTH_URL.*http:\/\/localhost:5173/s
		);
	});

	test('starts normally when they match', () => {
		expect(() =>
			assertOriginMatchesAuthUrl('http://localhost:5173', 'http://localhost:5173')
		).not.toThrow();
	});

	test('refuses to start when either is unset', () => {
		expect(() => assertOriginMatchesAuthUrl(undefined, 'http://localhost:5173')).toThrow(/ORIGIN/);
		expect(() => assertOriginMatchesAuthUrl('http://localhost:5173', undefined)).toThrow(
			/BETTER_AUTH_URL/
		);
	});
});

describe('createFirstUser', () => {
	test('two submissions that arrive together create exactly one user', async () => {
		const [first, second] = await Promise.all([
			createFirstUser({ email: 'first@example.com', password: PASSWORD, name: 'First' }),
			createFirstUser({ email: 'second@example.com', password: PASSWORD, name: 'Second' })
		]);

		// The second submission waits for the first, then sees the user it created: it stores
		// nothing and answers null, which is how the wizard knows to send it to /login.
		expect(first?.email).toBe('first@example.com');
		expect(second).toBeNull();
		expect(await (await auth.$context).internalAdapter.countTotalUsers()).toBe(1);
	});

	test('a failure writing the credential leaves no user row', async () => {
		const ctx = await auth.$context;
		const createAccount = ctx.internalAdapter.createAccount;
		ctx.internalAdapter.createAccount = async () => {
			throw new Error('disk full');
		};

		try {
			await expect(
				createFirstUser({ email: 'teacher@example.com', password: PASSWORD, name: 'Teacher' })
			).rejects.toThrow('disk full');
		} finally {
			ctx.internalAdapter.createAccount = createAccount;
		}

		expect(await hasUser()).toBe(false);
	});
});

describe('the better-auth password rule', () => {
	test('POST /api/auth/change-password refuses a password below the wizard’s minimum', async () => {
		await createFirstUser({ email: 'teacher@example.com', password: PASSWORD, name: 'Teacher' });

		const cookie = await signInCookie('teacher@example.com');

		// better-auth's own default is 8, which is the hole this closes.
		const refused = await post(
			'/api/auth/change-password',
			{ currentPassword: PASSWORD, newPassword: 'x'.repeat(8), revokeOtherSessions: false },
			cookie
		);
		expect(refused.status).toBe(400);
		expect(await refused.json()).toMatchObject({ code: 'PASSWORD_TOO_SHORT' });

		const accepted = await post(
			'/api/auth/change-password',
			{
				currentPassword: PASSWORD,
				newPassword: 'x'.repeat(MIN_PASSWORD_LENGTH),
				revokeOtherSessions: false
			},
			cookie
		);
		expect(accepted.status).toBe(200);
	});
});

describe('the sign-in doors', () => {
	test("better-auth's sign-in endpoint is closed; the form action is the only way in", async () => {
		await createFirstUser({ email: 'teacher@example.com', password: PASSWORD, name: 'Teacher' });

		const response = await post('/api/auth/sign-in/email', {
			email: 'teacher@example.com',
			password: PASSWORD
		});

		expect(response.status).toBe(404);
	});
});
