<script lang="ts">
	import XIcon from '@lucide/svelte/icons/x';
	import TagBadge from '$lib/components/tag-badge.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { existingTagNames, type FakeLesson } from '../fake.svelte';

	let { lesson }: { lesson: FakeLesson } = $props();

	let adding = $state(false);
	let name = $state('');

	function add(e: SubmitEvent) {
		e.preventDefault();
		const n = name.trim();
		if (n && !lesson.tags.includes(n)) lesson.tags.push(n);
		name = '';
		adding = false;
	}
</script>

<div class="flex flex-wrap items-center gap-1">
	{#each lesson.tags as tag (tag)}
		<TagBadge name={tag}>
			<button
				type="button"
				class="-mr-0.5 ml-0.5 rounded-full hover:opacity-70"
				aria-label="Remove {tag}"
				onclick={() => (lesson.tags = lesson.tags.filter((t) => t !== tag))}
			>
				<XIcon class="size-3" />
			</button>
		</TagBadge>
	{/each}
	{#if !adding}
		<Button
			variant="ghost"
			size="xs"
			class="text-xs text-muted-foreground"
			onclick={() => (adding = true)}
		>
			+ Add Tag
		</Button>
	{/if}
</div>

{#if adding}
	<form class="mt-2 flex gap-1" onsubmit={add}>
		<Input
			autofocus
			bind:value={name}
			required
			list="proto-tag-names"
			class="h-7 min-w-0 flex-1 text-xs md:text-xs"
			placeholder="Tag name"
		/>
		<Button type="submit" size="sm">Add</Button>
		<Button variant="ghost" size="sm" onclick={() => (adding = false)}>Cancel</Button>
	</form>
	<datalist id="proto-tag-names">
		{#each existingTagNames as n (n)}
			<option value={n}></option>
		{/each}
	</datalist>
{/if}
