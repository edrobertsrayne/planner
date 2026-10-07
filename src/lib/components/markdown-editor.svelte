<script lang="ts">
	import { onMount } from 'svelte';
	import type { Editor } from '@tiptap/core';
	import { cn } from '$lib/utils.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import BoldIcon from '@lucide/svelte/icons/bold';
	import ItalicIcon from '@lucide/svelte/icons/italic';
	import Heading2Icon from '@lucide/svelte/icons/heading-2';
	import Heading3Icon from '@lucide/svelte/icons/heading-3';
	import ListIcon from '@lucide/svelte/icons/list';
	import ListOrderedIcon from '@lucide/svelte/icons/list-ordered';
	import QuoteIcon from '@lucide/svelte/icons/quote';
	import CodeIcon from '@lucide/svelte/icons/code';
	import LinkIcon from '@lucide/svelte/icons/link';
	import SigmaIcon from '@lucide/svelte/icons/sigma';
	import SquareSigmaIcon from '@lucide/svelte/icons/square-sigma';
	import 'katex/dist/katex.min.css';

	let {
		value,
		label,
		placeholder = '',
		name,
		class: className,
		toolbarClass,
		bodyClass,
		onchange,
		onblur
	}: {
		value: string;
		label: string;
		placeholder?: string;
		name?: string;
		class?: string;
		toolbarClass?: string;
		bodyClass?: string;
		onchange?: (markdown: string) => void;
		onblur?: () => void;
	} = $props();

	// `value` seeds the editor once. The editor is the source of truth from then on: writing back
	// into it on every keystroke would fight the caret.
	let text = $state(value);
	let host: HTMLDivElement | null = $state(null);
	let editor = $state<Editor | null>(null);
	let active = $state<Record<string, boolean>>({});

	onMount(() => {
		let instance: Editor | null = null;
		// Imported here rather than at the top: ProseMirror is a browser editor, so this keeps it
		// out of the server render and out of the first load of every page that hosts one.
		(async () => {
			const [
				{ Editor: TiptapEditor },
				{ default: StarterKit },
				{ Markdown },
				{ Placeholder },
				{ InlineMath, BlockMath }
			] = await Promise.all([
				import('@tiptap/core'),
				import('@tiptap/starter-kit'),
				import('@tiptap/markdown'),
				import('@tiptap/extensions'),
				import('@tiptap/extension-mathematics'),
				import('katex/contrib/mhchem')
			]);
			if (!host) return;
			instance = new TiptapEditor({
				element: host,
				extensions: [
					StarterKit.configure({
						heading: { levels: [1, 2, 3] },
						// A click inside the editor puts the caret in the link text. Following a link is
						// the reader's action in the Session panel, not the writer's here.
						link: { openOnClick: false }
					}),
					Markdown,
					Placeholder.configure({ placeholder }),
					InlineMath.configure({
						katexOptions: { throwOnError: false, trust: false },
						onClick: (node, pos) => editFormula('inline', node.attrs.latex, pos)
					}),
					BlockMath.configure({
						katexOptions: { throwOnError: false, trust: false, displayMode: true },
						onClick: (node, pos) => editFormula('block', node.attrs.latex, pos)
					})
				],
				content: value,
				contentType: 'markdown',
				editorProps: {
					attributes: {
						// `.markdown` is the shared stylesheet; role/aria-label give the contenteditable
						// the accessible name a <label for> cannot provide.
						class: 'markdown min-h-40 outline-none',
						role: 'textbox',
						'aria-multiline': 'true',
						'aria-label': label
					}
				},
				onUpdate: ({ editor: e }) => {
					text = e.getMarkdown().trim();
					onchange?.(text);
				},
				onBlur: () => onblur?.(),
				onTransaction: ({ editor: e }) => {
					active = {
						bold: e.isActive('bold'),
						italic: e.isActive('italic'),
						h2: e.isActive('heading', { level: 2 }),
						h3: e.isActive('heading', { level: 3 }),
						bulletList: e.isActive('bulletList'),
						orderedList: e.isActive('orderedList'),
						blockquote: e.isActive('blockquote'),
						code: e.isActive('code'),
						link: e.isActive('link'),
						inlineMath: e.isActive('inlineMath'),
						blockMath: e.isActive('blockMath')
					};
				}
			});
			// @tiptap/markdown escapes \ ` * _ [ ] ~ in text but not $, so a typed "$5 and $10" would reload
			// as a formula. Code marks and code blocks bypass this method, so `$` stays raw there.
			const manager = instance.markdown as unknown as {
				escapeMarkdownSyntax(text: string): string;
			};
			const escapeText = manager.escapeMarkdownSyntax.bind(manager);
			manager.escapeMarkdownSyntax = (text) => escapeText(text).replace(/\$/g, '\\$');
			editor = instance;
		})();
		return () => {
			instance?.destroy();
			editor = null;
		};
	});

	// Mouse-down default is what moves focus off the editable. Keeping it means every toolbar
	// button acts on the selection already there, and leaves the blur-save for real exits.
	function hold(e: MouseEvent) {
		e.preventDefault();
	}

	function editLink() {
		if (!editor) return;
		const current = (editor.getAttributes('link').href as string | undefined) ?? 'https://';
		const url = window.prompt('Link URL', current);
		if (url === null) return;
		if (url === '') {
			editor.chain().focus().unsetLink().run();
			return;
		}
		editor.chain().focus().setLink({ href: url }).run();
	}

	function insertFormula(kind: 'inline' | 'block') {
		if (!editor) return;
		const latex = window.prompt('LaTeX formula', '');
		if (!latex) return;
		const chain = editor.chain().focus();
		(kind === 'inline'
			? chain.insertInlineMath({ latex })
			: chain.insertBlockMath({ latex })
		).run();
	}

	function editFormula(kind: 'inline' | 'block', current: string, pos: number) {
		if (!editor) return;
		const latex = window.prompt('LaTeX formula', current);
		if (latex === null) return;
		const chain = editor.chain().focus();
		if (latex === '') {
			(kind === 'inline' ? chain.deleteInlineMath({ pos }) : chain.deleteBlockMath({ pos })).run();
			return;
		}
		(kind === 'inline'
			? chain.updateInlineMath({ latex, pos })
			: chain.updateBlockMath({ latex, pos })
		).run();
	}
</script>

{#snippet tool(key: string, title: string, Icon: typeof BoldIcon, run: () => void)}
	<Button
		type="button"
		variant="ghost"
		size="icon-sm"
		aria-label={title}
		aria-pressed={active[key] ?? false}
		class={active[key] ? 'bg-accent text-accent-foreground' : ''}
		disabled={!editor}
		onmousedown={hold}
		onclick={run}
	>
		<Icon class="size-3.5" />
	</Button>
{/snippet}

<div class={cn('flex min-h-0 flex-col', className)}>
	<div
		class={cn(
			'flex flex-wrap items-center gap-0.5 rounded-t-2xl bg-input/50 px-1.5 py-1',
			toolbarClass
		)}
	>
		{@render tool('bold', 'Bold', BoldIcon, () => editor?.chain().focus().toggleBold().run())}
		{@render tool('italic', 'Italic', ItalicIcon, () =>
			editor?.chain().focus().toggleItalic().run()
		)}
		{@render tool('h2', 'Heading', Heading2Icon, () =>
			editor?.chain().focus().toggleHeading({ level: 2 }).run()
		)}
		{@render tool('h3', 'Subheading', Heading3Icon, () =>
			editor?.chain().focus().toggleHeading({ level: 3 }).run()
		)}
		{@render tool('bulletList', 'Bullet list', ListIcon, () =>
			editor?.chain().focus().toggleBulletList().run()
		)}
		{@render tool('orderedList', 'Numbered list', ListOrderedIcon, () =>
			editor?.chain().focus().toggleOrderedList().run()
		)}
		{@render tool('blockquote', 'Quote', QuoteIcon, () =>
			editor?.chain().focus().toggleBlockquote().run()
		)}
		{@render tool('code', 'Code', CodeIcon, () => editor?.chain().focus().toggleCode().run())}
		{@render tool('inlineMath', 'Formula', SigmaIcon, () => insertFormula('inline'))}
		{@render tool('blockMath', 'Display formula', SquareSigmaIcon, () => insertFormula('block'))}
		{@render tool('link', 'Link', LinkIcon, editLink)}
	</div>
	<div
		bind:this={host}
		class={cn('min-h-0 flex-1 overflow-y-auto rounded-b-2xl bg-input/50 px-2.5 py-2', bodyClass)}
	></div>
	{#if name}
		<input type="hidden" {name} value={text} />
	{/if}
</div>
