import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be an ISO YYYY-MM-DD date');

export const seedFileSchema = z.object({
	academicYear: z.string(),
	terms: z
		.array(
			z.object({
				name: z.string(),
				opens: isoDate,
				closes: isoDate
			})
		)
		.length(6, 'must contain exactly six Terms'),
	blockedDays: z.array(
		z.object({
			date: isoDate,
			note: z.string().optional()
		})
	)
});

export type SeedFile = z.infer<typeof seedFileSchema>;
