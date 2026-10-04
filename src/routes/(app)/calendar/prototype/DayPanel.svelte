<!--
	PROTOTYPE ONLY (issue #312). A day with no teaching: one panel, hatched for a Blocked Day, a
	solid step for a School Holiday.
-->
<script lang="ts">
	import type { Day } from './store.svelte';

	let { day, class: klass = '' }: { day: Day; class?: string } = $props();
</script>

<div
	class="flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-3 text-center {day.kind ===
	'holiday'
		? 'day-panel-holiday'
		: 'hatched border border-dashed border-muted-foreground/30'} {klass}"
>
	<div class="text-xs font-semibold text-muted-foreground">{day.note}</div>
	<div class="text-[11px] text-muted-foreground/70">
		{day.kind === 'holiday' ? 'Outside every Term' : 'No teaching'}
	</div>
</div>
