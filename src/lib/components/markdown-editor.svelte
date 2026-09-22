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

	let {
		value,
		label,
		placeholder = '',
		name,
		class: className,
		onchange,
		onblur
	}: {
		value: string;
		label: string;
		placeholder?: string;
		name?: string;
		class?: string;
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
			const [{ Editor: TiptapEditor }, { default: StarterKit }, { Markdown }, { Placeholder }] =
				await Promise.all([
					import('@tiptap/core'),
					import('@tiptap/starter-kit'),
					import('@tiptap/markdown'),
					import('@tiptap/extensions')
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
					Placeholder.configure({ placeholder })
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
						link: e.isActive('link')
					};
				}
			});
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
	<div class="flex flex-wrap items-center gap-0.5 rounded-t-2xl bg-input/50 px-1.5 py-1">
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
		{@render tool('link', 'Link', LinkIcon, editLink)}
	</div>
	<div
		bind:this={host}
		class="min-h-0 flex-1 overflow-y-auto rounded-b-2xl bg-input/50 px-2.5 py-2"
	></div>
	{#if name}
		<input type="hidden" {name} value={text} />
	{/if}
</div>
