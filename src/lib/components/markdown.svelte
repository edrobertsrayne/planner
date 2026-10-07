<script lang="ts">
	import 'katex/dist/katex.min.css';
	import { cn } from '$lib/utils.js';
	import { renderMarkdown } from '$lib/markdown';

	let { source, class: className }: { source: string | null; class?: string } = $props();
	const html = $derived(renderMarkdown(source));
</script>

<div class={cn('markdown', className)}>{@html html}</div>
