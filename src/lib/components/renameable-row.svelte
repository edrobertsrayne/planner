<script lang="ts">
	import { enhance } from '$app/forms';
	import { Input } from '$lib/components/ui/input/index.js';
	import { touchTarget } from '$lib/components/ui/touch-target.js';

	// A page or panel heading that its own page can rename in place. Every caller is a heading;
	// the pencil is the only control beside it.
	let {
		name,
		action,
		hidden,
		field = 'name',
		level = 1,
		editable = true
	}: {
		name: string;
		action: string;
		hidden: Record<string, string>;
		// The field its action reads: a Class renames by `label`, a Course or a Topic by `name`.
		field?: 'name' | 'label';
		// The heading's rank, and so its size: a page title or a panel title.
		level?: 1 | 2;
		// False shows the name with no pencil, to read the plan and not change it.
		editable?: boolean;
	} = $props();

	let editing = $state(false);

	function startEditing(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		editing = true;
	}
</script>

<div class="group flex items-baseline gap-2">
	{#if editing}
		<form
			method="POST"
			{action}
			class="flex items-center gap-2"
			use:enhance={() => {
				return async ({ result, update }) => {
					await update();
					if (result.type === 'success') editing = false;
				};
			}}
		>
			{#each Object.entries(hidden) as [key, value] (key)}
				<input type="hidden" name={key} {value} />
			{/each}
			<Input
				autofocus
				class="h-8 w-56 text-lg font-semibold"
				name={field}
				value={name}
				onkeydown={(e) => {
					if (e.key === 'Escape') {
						e.preventDefault();
						editing = false;
					}
				}}
				onblur={() => (editing = false)}
			/>
		</form>
	{:else}
		<svelte:element
			this={level === 1 ? 'h1' : 'h2'}
			class="min-w-0 font-semibold {level === 1 ? 'text-lg tracking-tight' : 'text-base'}"
		>
			{name}
		</svelte:element>
		{#if editable}
			<button
				type="button"
				class="{touchTarget} shrink-0 text-xs text-muted-foreground row-control hover:text-foreground"
				onclick={startEditing}
				aria-label="Rename {name}"
			>
				✎
			</button>
		{/if}
	{/if}
</div>
