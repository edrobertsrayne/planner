<!-- PROTOTYPE ONLY (issue #306): a ⋯ menu of row or page actions. Hidden on a phone. -->
<script lang="ts">
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';

	let {
		label,
		items
	}: {
		label: string;
		items: { label: string; onclick: () => void; destructive?: boolean; hint?: string }[];
	} = $props();
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="ghost" size="icon-sm" class="max-md:hidden" aria-label={label}>
				<EllipsisIcon class="size-4" />
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end" class="w-60">
		{#each items as item (item.label)}
			<DropdownMenu.Item
				onclick={item.onclick}
				class={item.destructive ? 'text-destructive focus:text-destructive' : ''}
			>
				<div class="flex flex-col">
					<span>{item.label}</span>
					{#if item.hint}<span class="text-xs text-muted-foreground">{item.hint}</span>{/if}
				</div>
			</DropdownMenu.Item>
		{/each}
	</DropdownMenu.Content>
</DropdownMenu.Root>
