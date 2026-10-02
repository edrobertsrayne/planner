<script lang="ts">
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { Button } from '$lib/components/ui/button/index.js';

	let { index, count, onstep }: { index: number; count: number; onstep: (delta: number) => void } =
		$props();
</script>

<span class="flex items-center gap-0.5">
	<span class="mr-1 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
		Lesson {index + 1} of {count}
	</span>
	<Button
		variant="ghost"
		size="icon-sm"
		disabled={index === 0}
		onclick={() => onstep(-1)}
		aria-label="Previous Lesson"
	>
		<ChevronUpIcon class="size-3.5" />
	</Button>
	<Button
		variant="ghost"
		size="icon-sm"
		disabled={index === count - 1}
		onclick={() => onstep(1)}
		aria-label="Next Lesson"
	>
		<ChevronDownIcon class="size-3.5" />
	</Button>
</span>
