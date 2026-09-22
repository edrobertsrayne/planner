import MarkdownIt from 'markdown-it';

// `html: false` is the whole of the safety story: no raw HTML token reaches the output, so the
// string can go straight into {@html} without a sanitiser. markdown-it refuses javascript: and
// vbscript: link targets by itself. `breaks: true` keeps the line structure of every body
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

export function renderMarkdown(source: string | null | undefined): string {
	return source ? md.render(source) : '';
}
