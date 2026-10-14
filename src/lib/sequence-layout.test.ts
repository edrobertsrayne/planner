import { describe, expect, test } from 'vitest';
import { layOutSequence } from './sequence-layout';

describe('layOutSequence', () => {
	test('lays the Lessons through the Slots in order, a Length-2 Lesson in two Slots', () => {
		const { fills, pastEnd } = layOutSequence(
			[
				{ lessonId: 'a', parts: 1 },
				{ lessonId: 'b', parts: 2 }
			],
			['s1', 's2', 's3', 's4']
		);
		expect([...fills]).toEqual([
			['s1', { lessonId: 'a', part: 1, of: 1 }],
			['s2', { lessonId: 'b', part: 1, of: 2 }],
			['s3', { lessonId: 'b', part: 2, of: 2 }]
		]);
		expect(pastEnd).toEqual([]);
	});

	test('a Lesson with no Slot left is past the end, once', () => {
		const { fills, pastEnd } = layOutSequence(
			[
				{ lessonId: 'a', parts: 1 },
				{ lessonId: 'b', parts: 2 },
				{ lessonId: 'c', parts: 1 }
			],
			['s1', 's2']
		);
		expect([...fills.keys()]).toEqual(['s1', 's2']);
		expect(pastEnd).toEqual(['b', 'c']);
	});
});
