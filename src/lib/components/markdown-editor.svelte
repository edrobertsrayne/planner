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
	// into it on every keystroke would fight the caret. A caller whose value can change under a
	// mounted editor — the Session panel's note, when its Lesson changes (issue #409) — remounts
	// the editor rather than relying on this to follow.
	// svelte-ignore state_referenced_locally
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
					active = Object.fromEntries(TOOLS.map((tool) => [tool.key, tool.isActive(e)]));
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

	// The toolbar, once: each tool's active key, label, icon, the question the editor answers about
	// it, and the command it runs. The render loop and `onTransaction` both read this table, so a
	// tool cannot be listed in one place and forgotten in the other.
	const TOOLS: {
		key: string;
		title: string;
		Icon: typeof BoldIcon;
		isActive: (editor: Editor) => boolean;
		run: () => void;
	}[] = [
		{
			key: 'bold',
			title: 'Bold',
			Icon: BoldIcon,
			isActive: (e) => e.isActive('bold'),
			run: () => editor?.chain().focus().toggleBold().run()
		},
		{
			key: 'italic',
			title: 'Italic',
			Icon: ItalicIcon,
			isActive: (e) => e.isActive('italic'),
			run: () => editor?.chain().focus().toggleItalic().run()
		},
		{
			key: 'h2',
			title: 'Heading',
			Icon: Heading2Icon,
			isActive: (e) => e.isActive('heading', { level: 2 }),
			run: () => editor?.chain().focus().toggleHeading({ level: 2 }).run()
		},
		{
			key: 'h3',
			title: 'Subheading',
			Icon: Heading3Icon,
			isActive: (e) => e.isActive('heading', { level: 3 }),
			run: () => editor?.chain().focus().toggleHeading({ level: 3 }).run()
		},
		{
			key: 'bulletList',
			title: 'Bullet list',
			Icon: ListIcon,
			isActive: (e) => e.isActive('bulletList'),
			run: () => editor?.chain().focus().toggleBulletList().run()
		},
		{
			key: 'orderedList',
			title: 'Numbered list',
			Icon: ListOrderedIcon,
			isActive: (e) => e.isActive('orderedList'),
			run: () => editor?.chain().focus().toggleOrderedList().run()
		},
		{
			key: 'blockquote',
			title: 'Quote',
			Icon: QuoteIcon,
			isActive: (e) => e.isActive('blockquote'),
			run: () => editor?.chain().focus().toggleBlockquote().run()
		},
		{
			key: 'code',
			title: 'Code',
			Icon: CodeIcon,
			isActive: (e) => e.isActive('code'),
			run: () => editor?.chain().focus().toggleCode().run()
		},
		{
			key: 'inlineMath',
			title: 'Formula',
			Icon: SigmaIcon,
			isActive: (e) => e.isActive('inlineMath'),
			run: () => insertFormula('inline')
		},
		{
			key: 'blockMath',
			title: 'Display formula',
			Icon: SquareSigmaIcon,
			isActive: (e) => e.isActive('blockMath'),
			run: () => insertFormula('block')
		},
		{
			key: 'link',
			title: 'Link',
			Icon: LinkIcon,
			isActive: (e) => e.isActive('link'),
			run: editLink
		}
	];
</script>

<div class={cn('flex min-h-0 flex-col', className)}>
	<div
		class={cn(
			'flex flex-wrap items-center gap-0.5 rounded-t-2xl bg-input/50 px-1.5 py-1',
			toolbarClass
		)}
	>
		{#each TOOLS as tool (tool.key)}
			{@const Icon = tool.Icon}
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				aria-label={tool.title}
				aria-pressed={active[tool.key] ?? false}
				class={active[tool.key] ? 'bg-accent text-accent-foreground' : ''}
				disabled={!editor}
				onmousedown={hold}
				onclick={tool.run}
			>
				<Icon class="size-3.5" />
			</Button>
		{/each}
	</div>
	<div
		bind:this={host}
		class={cn('min-h-0 flex-1 overflow-y-auto rounded-b-2xl bg-input/50 px-2.5 py-2', bodyClass)}
	></div>
	{#if name}
		<input type="hidden" {name} value={text} />
	{/if}
</div>
