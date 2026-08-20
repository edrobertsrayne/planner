<!--
	PROTOTYPE — throwaway. A — Two surfaces, restyled. Today's shape (separate Agenda and Calendar
	destinations) carried onto rhea/shadcn. Answers "what does the derived schedule look like"
	without touching the "one screen or two" question — the IA is unchanged, four top-level tabs,
	and the top nav itself switches between them (Classes/Courses are inert placeholders here).
-->
<script lang="ts">
	import ScheduleShell from './ScheduleShell.svelte';
	import AgendaList from './AgendaList.svelte';
	import WeekGrid from './WeekGrid.svelte';
	import type { PageData } from './$types';

	let { data, onNav }: { data: PageData; onNav: (weekCommencing: string) => void } = $props();

	let tab = $state<'Agenda' | 'Calendar'>('Agenda');
</script>

<ScheduleShell
	tabs={['Agenda', 'Calendar', 'Classes', 'Courses']}
	active={tab}
	onSelect={(t) => {
		if (t === 'Agenda' || t === 'Calendar') tab = t;
	}}
>
	{#if tab === 'Agenda'}
		<AgendaList rows={data.rows} today={data.today} />
	{:else}
		<WeekGrid week={data.week} prev={data.prev} next={data.next} {onNav} />
	{/if}
</ScheduleShell>
