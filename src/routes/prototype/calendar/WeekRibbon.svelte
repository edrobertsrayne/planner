<!--
	PROTOTYPE — throwaway. Shared across all three variants, because #69 asks about the grid, not
	about week navigation. Kept in today's shape — arrows around a ribbon of Teaching Weeks, each
	pill carrying its letter — and restyled onto shadcn: ghost icon Buttons for the steps, a
	`toggle-group` for the ribbon itself. The letter switch, which today is an underlined sentence
	floated to the right of the row, becomes a plain ghost Button in the header's actions.

	Note the pill has to carry its date as well as its letter: five pills reading "A B A B A" are
	not distinguishable, which is why today's version needs a `title` tooltip to be usable at all.
-->
<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import { fmtDay } from './fixtures.js';

	let {
		weeks,
		selected,
		onselect
	}: {
		weeks: { weekCommencing: string; letter: 'A' | 'B'; offset: number }[];
		selected: string;
		onselect: (weekCommencing: string) => void;
	} = $props();

	const index = $derived(weeks.findIndex((w) => w.weekCommencing === selected));
	const current = $derived(weeks[index]);
</script>

<div class="flex items-center gap-2">
	<Button
		variant="ghost"
		size="icon"
		class="size-7"
		disabled={index <= 0}
		onclick={() => onselect(weeks[index - 1].weekCommencing)}
		aria-label="Previous Teaching Week"
	>
		<ChevronLeftIcon />
	</Button>

	<div class="flex items-center gap-0.5 rounded-md border p-0.5">
		{#each weeks as w (w.weekCommencing)}
			{@const isSelected = w.weekCommencing === selected}
			<button
				type="button"
				onclick={() => onselect(w.weekCommencing)}
				aria-current={isSelected ? 'true' : undefined}
				class="h-6 rounded-sm px-2 text-xs font-medium tabular-nums {isSelected
					? 'bg-secondary text-secondary-foreground'
					: 'text-muted-foreground hover:bg-muted'}"
			>
				{w.letter}<span class="ml-1 font-normal opacity-70">{fmtDay(w.weekCommencing)}</span>
			</button>
		{/each}
	</div>

	<Button
		variant="ghost"
		size="icon"
		class="size-7"
		disabled={index >= weeks.length - 1}
		onclick={() => onselect(weeks[index + 1].weekCommencing)}
		aria-label="Next Teaching Week"
	>
		<ChevronRightIcon />
	</Button>

	<Button variant="ghost" size="sm" class="h-7 text-muted-foreground">
		Switch to Week {current?.letter === 'A' ? 'B' : 'A'}
	</Button>
</div>
