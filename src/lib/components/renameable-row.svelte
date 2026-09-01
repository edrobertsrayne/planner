<script lang="ts">
	import { enhance } from '$app/forms';
	import { Input } from '$lib/components/ui/input/index.js';

	let {
		name,
		selected = false,
		href,
		action,
		hidden,
		field = 'name',
		heading = false
	}: {
		name: string;
		selected?: boolean;
		href?: string;
		action: string;
		hidden: Record<string, string>;
		field?: 'name' | 'title' | 'label';
		heading?: boolean;
	} = $props();

	let editing = $state(false);

	function startEditing(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		editing = true;
	}
</script>

<div class={heading ? 'group flex items-baseline gap-2' : 'group flex items-stretch'}>
	{#if editing}
		<form
			method="POST"
			{action}
			class={heading ? 'flex items-center gap-2' : 'flex flex-1 items-center px-4 py-1.5'}
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
				class={heading ? 'h-8 w-56 text-lg font-semibold' : 'h-7'}
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
		{#if heading}
			<h1 class="text-lg font-semibold tracking-tight">{name}</h1>
		{:else if href}
			<a
				{href}
				class="flex flex-1 items-baseline justify-between px-4 py-2 text-sm hover:bg-accent {selected
					? 'bg-accent font-medium'
					: ''}"
			>
				<span class="min-w-0 truncate">{name}</span>
			</a>
		{:else}
			<span class="flex flex-1 items-baseline px-4 py-2 text-sm">
				<span class="min-w-0 truncate">{name}</span>
			</span>
		{/if}
		<button
			type="button"
			class="shrink-0 {heading
				? ''
				: 'px-2'} text-xs text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground"
			onclick={startEditing}
			aria-label="Rename {name}"
		>
			✎
		</button>
	{/if}
</div>
