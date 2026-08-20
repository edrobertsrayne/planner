<!--
	PROTOTYPE — throwaway. B — The week is the app. One merged "Schedule" destination (three top
	tabs, not four): the Teaching Week grid is primary and full-width, with a compact "Up next"
	agenda rail alongside it showing only the next few occasions rather than the full horizon.
	Tests whether the grid alone can carry both jobs — "what's the shape of the fortnight" and
	"what's coming next" — without a separate chronological screen.
-->
<script lang="ts">
	import ScheduleShell from './ScheduleShell.svelte';
	import AgendaList from './AgendaList.svelte';
	import WeekGrid from './WeekGrid.svelte';
	import type { PageData } from './$types';

	let { data, onNav }: { data: PageData; onNav: (weekCommencing: string) => void } = $props();

	// "Up next" shows a handful of rows, not the full agenda — the rail is a glance, not a second
	// full screen.
	const upNext = $derived(data.rows.slice(0, 6));
</script>

<ScheduleShell tabs={['Schedule', 'Classes', 'Courses']} active="Schedule">
	<div class="flex gap-6">
		<div class="min-w-0 flex-1">
			<WeekGrid week={data.week} prev={data.prev} next={data.next} {onNav} />
		</div>
		<aside class="w-64 shrink-0 border-l pl-6">
			<h2 class="mb-2 text-sm font-semibold text-foreground">Up next</h2>
			<AgendaList rows={upNext} today={data.today} dense />
		</aside>
	</div>
</ScheduleShell>
