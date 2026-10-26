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
	// Escape closes the field, and removing the focused input can still fire its blur handler; the
	// flag tells that blur that the name was abandoned, not finished.
	let abandoned = false;

	function startEditing(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		abandoned = false;
		editing = true;
	}

	// A name typed and then left saves, as Enter does: the same two rules whichever way the teacher
	// leaves the field. An unchanged name closes with no request at all.
	function saveOnBlur(e: FocusEvent & { currentTarget: HTMLInputElement }) {
		if (abandoned) {
			abandoned = false;
			return;
		}
		// A submitted field closes and leaves the page, and its own removal can fire this blur
		// afterwards with the old name still in the heading: there is nothing left to save.
		if (!e.currentTarget.isConnected) return;
		if (e.currentTarget.value === name) {
			editing = false;
			return;
		}
		e.currentTarget.form?.requestSubmit();
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
						abandoned = true;
						editing = false;
					}
				}}
				onblur={saveOnBlur}
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
