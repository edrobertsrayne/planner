<!-- PROTOTYPE ONLY (issue #311): the Session note, in the real markdown editor, held in memory. -->
<script lang="ts">
	import MarkdownEditor from '$lib/components/markdown-editor.svelte';
	import { notes } from '../prototype-agenda/store.svelte';
	import type { Detail } from './store.svelte';

	let { d, heading = true }: { d: Detail; heading?: boolean } = $props();
</script>

<div id="session-note">
	{#if heading}
		<div class="mb-1.5 flex items-baseline justify-between">
			<span class="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
				How it went
			</span>
			<span class="text-xs text-muted-foreground">stays with the occasion</span>
		</div>
	{/if}
	{#key d.row.key}
		<MarkdownEditor
			value={notes[d.row.key] ?? ''}
			label="How it went"
			placeholder="Notes on this Session…"
			onchange={(md) => (notes[d.row.key] = md)}
		/>
	{/key}
</div>
