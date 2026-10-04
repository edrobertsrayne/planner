<!-- PROTOTYPE ONLY (issue #311): the Lesson's plan, Links and Attachments, read-only. -->
<script lang="ts">
	import DownloadIcon from '@lucide/svelte/icons/download';
	import LinkIcon from '@lucide/svelte/icons/link';
	import Markdown from '$lib/components/markdown.svelte';
	import type { Detail } from './store.svelte';

	let { d, compact = false }: { d: Detail; compact?: boolean } = $props();
</script>

{#if d.row.lesson}
	{#if d.plan}
		<Markdown source={d.plan} class="text-sm {compact ? 'line-clamp-6' : ''}" />
	{:else}
		<p class="text-sm text-muted-foreground italic">
			No plan written yet — a title alone is a complete Lesson.
		</p>
	{/if}
	{#if d.links.length || d.attachments.length}
		<ul class="mt-4 space-y-1">
			{#each d.links as l (l.url)}
				<li>
					<a
						href={l.url}
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex min-h-11 items-center gap-2 text-sm text-primary underline-offset-2 hover:underline md:min-h-0"
					>
						<LinkIcon class="size-3.5" />{l.label}
					</a>
				</li>
			{/each}
			{#each d.attachments as a (a.name)}
				<li>
					<button
						type="button"
						class="inline-flex min-h-11 items-center gap-2 text-sm text-primary underline-offset-2 hover:underline md:min-h-0"
					>
						<DownloadIcon class="size-3.5" />{a.name}
						<span class="text-xs text-muted-foreground">{a.size}</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
{/if}
