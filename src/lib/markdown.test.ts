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

describe('renderMarkdown maths', () => {
	test('renders inline maths', () => {
		const html = renderMarkdown('Speed $v = u + at$ here');
		expect(html).toContain('class="katex"');
		expect(html).not.toContain('$v');
	});

	test('allows a space after the opening dollar, as the editor does', () => {
		expect(renderMarkdown('$ x $')).toContain('class="katex"');
	});

	test('renders block maths', () => {
		const html = renderMarkdown('$$\nF = ma\n$$');
		expect(html).toContain('class="math-block"');
		expect(html).toContain('katex-display');
	});

	test('loads mhchem', () => {
		expect(renderMarkdown('$\\ce{H2O}$')).not.toContain('katex-error');
	});

	test('shows invalid LaTeX as an error without throwing', () => {
		expect(renderMarkdown('$\\frac{1}{$')).toContain('katex-error');
	});

	test('refuses \\href targets', () => {
		expect(renderMarkdown('$\\href{javascript:alert(1)}{x}$')).not.toContain('href="javascript');
	});

	test('keeps an escaped dollar literal', () => {
		const html = renderMarkdown('\\$5 and \\$10');
		expect(html).toContain('$5 and $10');
		expect(html).not.toContain('katex');
	});

	test('leaves dollars in code alone', () => {
		expect(renderMarkdown('`$x$`')).toContain('<code>$x$</code>');
	});
});
