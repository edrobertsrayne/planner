<script lang="ts">
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { hostOf, type FakeLesson } from '../fake.svelte';

	// `roomy` gives each Link a two-line row (label over host) for the layouts with width to spare.
	let { lesson, roomy = false }: { lesson: FakeLesson; roomy?: boolean } = $props();

	let adding = $state(false);
	let label = $state('');
	let url = $state('');

	function add(e: SubmitEvent) {
		e.preventDefault();
		lesson.links.push({ id: crypto.randomUUID(), label, url });
		label = '';
		url = '';
		adding = false;
	}
</script>

<ul class="space-y-1">
	{#each lesson.links as link (link.id)}
		<li
			class="group flex items-center gap-2 rounded-md bg-muted px-2 {roomy
				? 'py-2'
				: 'py-1.5'} text-sm"
		>
			<ExternalLinkIcon class="size-3.5 shrink-0 text-muted-foreground" />
			<span class="min-w-0 flex-1">
				<a
					href={link.url}
					target="_blank"
					rel="noopener noreferrer"
					class="block truncate hover:underline"
				>
					{link.label}
				</a>
				{#if roomy}
					<span class="block truncate text-xs text-muted-foreground">{hostOf(link.url)}</span>
				{/if}
			</span>
			<Button
				variant="ghost"
				size="icon-xs"
				class="opacity-0 group-hover:opacity-100"
				aria-label="Remove {link.label}"
				onclick={() => (lesson.links = lesson.links.filter((l) => l.id !== link.id))}
			>
				<XIcon />
			</Button>
		</li>
	{/each}
	{#if !lesson.links.length}
		<li class="px-1 py-1 text-xs text-muted-foreground">No Links yet.</li>
	{/if}
</ul>

{#if adding}
	<form class="mt-2 space-y-1" onsubmit={add}>
		<Input
			autofocus
			bind:value={label}
			required
			class="h-7 text-xs md:text-xs"
			placeholder="Label"
		/>
		<div class="flex gap-1">
			<Input
				bind:value={url}
				type="url"
				required
				class="h-7 min-w-0 flex-1 text-xs md:text-xs"
				placeholder="https://…"
			/>
			<Button type="submit" size="sm">Add</Button>
			<Button variant="ghost" size="sm" onclick={() => (adding = false)}>Cancel</Button>
		</div>
	</form>
{:else}
	<Button
		variant="ghost"
		size="sm"
		class="mt-1 text-xs text-muted-foreground"
		onclick={() => (adding = true)}
	>
		+ Add Link
	</Button>
{/if}
