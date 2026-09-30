import { describe, expect, it } from 'vitest';
import { crossSiteFormRefused } from './guard';

const site = 'https://planner.example';
const form = {
	method: 'POST',
	pathname: '/courses',
	contentType: 'multipart/form-data; boundary=x'
};

describe('crossSiteFormRefused', () => {
	it('refuses a form write from another origin, or with no origin, outside /api', () => {
		expect(
			crossSiteFormRefused({ ...form, origin: 'https://evil.example', siteOrigin: site })
		).toBe(true);
		expect(crossSiteFormRefused({ ...form, origin: null, siteOrigin: site })).toBe(true);
	});

	it('lets a same-origin form write, a JSON write and a read through', () => {
		expect(crossSiteFormRefused({ ...form, origin: site, siteOrigin: site })).toBe(false);
		expect(
			crossSiteFormRefused({
				...form,
				contentType: 'application/json',
				origin: 'https://evil.example',
				siteOrigin: site
			})
		).toBe(false);
		expect(crossSiteFormRefused({ ...form, method: 'GET', origin: null, siteOrigin: site })).toBe(
			false
		);
	});

	it('leaves /api to its Bearer key, so a script can upload a file with no origin', () => {
		expect(
			crossSiteFormRefused({
				...form,
				pathname: '/api/lessons/1/attachments',
				origin: null,
				siteOrigin: site
			})
		).toBe(false);
	});
});
