<!--
	PROTOTYPE ONLY (issue #313). The "Timetable as at" control, as today: named stops, any date, and
	a Read-only badge for a past date. Moves the `on` search param.
-->
<script lang="ts">
	import { formatDate } from '$lib/date';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { TODAY, YEAR_START, onParam, setOn, stops, type Klass } from './store.svelte';

	let { klass, label = true }: { klass: Klass; label?: boolean } = $props();
	const on = $derived(onParam());
	const name = (d: string) =>
		d === YEAR_START
			? `Start of year — ${formatDate(d)}`
			: d === TODAY
				? `Today — ${formatDate(d)}`
				: formatDate(d);
</script>

<div class="flex flex-wrap items-center gap-2">
	{#if label}<span class="text-xs font-medium text-muted-foreground">Timetable as at</span>{/if}
	<Select.Root type="single" value={on} onValueChange={(v) => v && setOn(v)}>
		<Select.Trigger size="sm" class="h-7 w-56 text-xs">{formatDate(on)}</Select.Trigger>
		<Select.Content>
			{#each stops(klass.id) as d (d)}
				<Select.Item value={d} label={name(d)} />
			{/each}
		</Select.Content>
	</Select.Root>
	<input
		type="date"
		class="h-7 rounded-md border bg-transparent px-2 text-xs"
		value={on}
		onchange={(e) => setOn(e.currentTarget.value)}
		aria-label="Timetable as at — pick any date"
	/>
	{#if on < TODAY}
		<Badge variant="outline" class="text-muted-foreground">Read-only — past</Badge>
	{/if}
</div>
