<!--
	PROTOTYPE — throwaway. A — Persistent aside. Today's shape, restyled on rhea.

	The Session is a fixed-width right column that squeezes the schedule beside it. Selection lives
	in a client store, so it is not in the URL: not linkable, not survivable across a reload, and
	the browser Back button does nothing to it. What it buys is that the schedule stays visible and
	usable *while* the Session is open — click straight from one occasion to the next.

	Judge: does the squeezed schedule still work, especially the Teaching Week grid at 6 periods?
-->
<script lang="ts">
	import { sessionPanel } from '$lib/client/session-panel.svelte';
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '$lib/components/ui/button/index.js';
	import SessionShell from './SessionShell.svelte';
	import AgendaList from './AgendaList.svelte';
	import WeekGrid from './WeekGrid.svelte';
	import SessionBody from './SessionBody.svelte';
	import type { PageData } from './$types';

	let { data, onNav }: { data: PageData; onNav: (weekCommencing: string) => void } = $props();

	let tab = $state<'Agenda' | 'Calendar'>('Agenda');
</script>

<SessionShell
	tabs={['Agenda', 'Calendar', 'Classes', 'Courses']}
	active={tab}
	onSelect={(t) => {
		if (t === 'Agenda' || t === 'Calendar') tab = t;
	}}
>
	<main class="flex min-h-0 flex-1">
		<div class="min-w-0 flex-1 overflow-y-auto px-6 py-6">
			{#if tab === 'Agenda'}
				<AgendaList
					rows={data.rows}
					today={data.today}
					onOpen={(o) => sessionPanel.open(o)}
					selected={sessionPanel.selected}
				/>
			{:else}
				<WeekGrid
					week={data.week}
					prev={data.prev}
					next={data.next}
					{onNav}
					onOpen={(o) => sessionPanel.open(o)}
					selected={sessionPanel.selected}
				/>
			{/if}
		</div>

		{#if sessionPanel.selected}
			<aside class="w-96 shrink-0 overflow-y-auto border-l bg-card px-5 py-5">
				<div class="mb-1 flex justify-end">
					<Button
						variant="ghost"
						size="sm"
						onclick={() => sessionPanel.close()}
						aria-label="Close Session"
					>
						<XIcon class="size-4" />
					</Button>
				</div>
				<SessionBody occasion={sessionPanel.selected} />
			</aside>
		{/if}
	</main>
</SessionShell>
