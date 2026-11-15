import { describe, expect, test } from 'vitest';
import { bodyOf } from './occasion';

const request = (body: string) => new Request('http://localhost/session', { method: 'POST', body });

describe('a Session route reads its body', () => {
	test('a JSON object is handed on as it is', async () => {
		await expect(bodyOf(request('{"classId":"c1","period":2}'))).resolves.toEqual({
			classId: 'c1',
			period: 2
		});
	});

	test.each(['{', '', 'null', '[1]', '7'])(
		'%j is a bad request, not a server fault',
		async (body) => {
			await expect(bodyOf(request(body))).rejects.toMatchObject({ status: 400 });
		}
	);
});
