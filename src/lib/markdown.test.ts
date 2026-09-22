import { describe, expect, test } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
	test('renders headings, lists and bold runs', () => {
		const html = renderMarkdown('## Aims\n\n- Recap **Newton I**');
		expect(html).toContain('<h2>Aims</h2>');
		expect(html).toContain('<li>');
		expect(html).toContain('<strong>Newton I</strong>');
	});

	test('escapes raw HTML rather than passing it through', () => {
		const html = renderMarkdown('<script>alert(1)</script>');
		expect(html).toContain('&lt;script&gt;');
		expect(html).not.toContain('<script>');
	});

	test('refuses javascript: link targets', () => {
		const html = renderMarkdown('[x](javascript:alert(1))');
		expect(html).not.toContain('<a');
	});

	test('opens links in a new tab like a Lesson Link', () => {
		const html = renderMarkdown('[OneDrive](https://example.com)');
		expect(html).toContain('target="_blank"');
		expect(html).toContain('rel="noopener noreferrer"');
	});

	test('empty input renders nothing', () => {
		expect(renderMarkdown(null)).toBe('');
		expect(renderMarkdown('')).toBe('');
	});
});
