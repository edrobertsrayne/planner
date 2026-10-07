import MarkdownIt from 'markdown-it';
import katex, { type KatexOptions } from 'katex';
import 'katex/contrib/mhchem';

// `html: false` and KaTeX `trust: false` together are the whole of the safety story: no raw HTML
// token reaches the output and KaTeX refuses link/class macros, so the string can go straight into
// {@html} without a sanitiser. markdown-it refuses javascript: and vbscript: link targets by
// itself. `breaks: true` keeps the line structure of every body
// written before this — they were displayed with whitespace-pre-line, so a single newline has
// always been a line break here.
const md = new MarkdownIt({ html: false, linkify: true, breaks: true, typographer: false });

// A plan links out to OneDrive and the like — the same new-tab treatment a Lesson Link gets in
// the Session panel.
const renderLinkOpen =
	md.renderer.rules.link_open ??
	((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
	tokens[idx].attrSet('target', '_blank');
	tokens[idx].attrSet('rel', 'noopener noreferrer');
	return renderLinkOpen(tokens, idx, options, env, self);
};

// Maths: the regexes are copied from @tiptap/extension-mathematics so the read-only view reads
// stored text exactly as the editor does. `trust: false` (KaTeX's default, stated so nobody flips
// it) refuses \href, \url and \htmlClass. With `html: false` it keeps the {@html} safe.
const katexOptions: KatexOptions = { throwOnError: false, trust: false };

md.inline.ruler.after('backticks', 'math_inline', (state, silent) => {
	if (state.src.charCodeAt(state.pos) !== 0x24 /* $ */) return false;
	const match = /^\$([^$]+)\$(?!\$)/.exec(state.src.slice(state.pos));
	if (!match) return false;
	if (!silent) state.push('math_inline', '', 0).content = match[1];
	state.pos += match[0].length;
	return true;
});

md.block.ruler.before(
	'fence',
	'math_block',
	(state, startLine, endLine, silent) => {
		const start = state.bMarks[startLine] + state.tShift[startLine];
		if (state.src.slice(start, start + 2) !== '$$') return false;
		const match = /^\$\$([^$]+)\$\$/.exec(state.src.slice(start));
		if (!match) return false;
		if (silent) return true;
		const end = start + match[0].length;
		let line = startLine;
		while (line < endLine - 1 && state.eMarks[line] < end) line++;
		const token = state.push('math_block', '', 0);
		token.block = true;
		token.content = match[1].trim();
		token.map = [startLine, line + 1];
		state.line = line + 1;
		return true;
	},
	{ alt: ['paragraph', 'reference', 'blockquote', 'list'] }
);

md.renderer.rules.math_inline = (tokens, idx) =>
	katex.renderToString(tokens[idx].content, { ...katexOptions, displayMode: false });
md.renderer.rules.math_block = (tokens, idx) =>
	`<div class="math-block">${katex.renderToString(tokens[idx].content, { ...katexOptions, displayMode: true })}</div>\n`;

export function renderMarkdown(source: string | null | undefined): string {
	return source ? md.render(source) : '';
}
