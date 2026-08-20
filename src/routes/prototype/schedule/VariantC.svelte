<!--
	PROTOTYPE — throwaway. C — One destination, two views. Same merged "Schedule" tab as B, but
	instead of showing both surfaces at once, a shadcn Tabs control switches between a List view
	(the Agenda) and a Grid view (the Calendar) of the same underlying schedule. Tests whether
	"one screen" can mean "one destination that presents either shape" rather than a layout that
	merges both simultaneously.
-->
<script lang="ts">
	import ScheduleShell from './ScheduleShell.svelte';
	import AgendaList from './AgendaList.svelte';
	import WeekGrid from './WeekGrid.svelte';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import type { PageData } from './$types';

	let { data, onNav }: { data: PageData; onNav: (weekCommencing: string) => void } = $props();
</script>

<ScheduleShell tabs={['Schedule', 'Classes', 'Courses']} active="Schedule">
	<Tabs.Root value="list">
		<Tabs.List>
			<Tabs.Trigger value="list">List</Tabs.Trigger>
			<Tabs.Trigger value="grid">Grid</Tabs.Trigger>
		</Tabs.List>
		<Tabs.Content value="list" class="pt-4">
			<AgendaList rows={data.rows} today={data.today} />
		</Tabs.Content>
		<Tabs.Content value="grid" class="pt-4">
			<WeekGrid week={data.week} prev={data.prev} next={data.next} {onNav} />
		</Tabs.Content>
	</Tabs.Root>
</ScheduleShell>
