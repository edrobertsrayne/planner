<!--
	PROTOTYPE — throwaway. B — The Session is its own destination.

	Selection lives in the URL, so this stands in for a real route (/session/<class>/<date>/<period>
	in production; a search param here because the prototype has to share one route). The Session
	*replaces* the schedule: full width, its own PageHeader-shaped top bar with a Back control, and
	the `wide` content hierarchy — the Lesson plan and "How it went" as two equal columns rather
	than a plan with a note tacked under it.

	It is linkable, it survives a reload, and browser Back closes it. It costs you the schedule:
	moving through a week means going back out each time.

	Judge: reload the page with a Session open, and press Back. Then ask whether losing the
	schedule beside it actually hurts, or whether a Session is a place you go and stay.
-->
<script lang="ts">
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { Occasion } from '$lib/client/session-panel.svelte';
	import SessionShell from './SessionShell.svelte';
	import AgendaList from './AgendaList.svelte';
	import WeekGrid from './WeekGrid.svelte';
	import SessionBody from './SessionBody.svelte';
	import type { PageData } from './$types';

	let {
		data,
		onNav,
		selected,
		onSelect
	}: {
		data: PageData;
		onNav: (weekCommencing: string) => void;
		selected: Occasion | null;
		onSelect: (occasion: Occasion | null) => void;
	} = $props();

	let tab = $state<'Agenda' | 'Calendar'>('Agenda');
</script>

<SessionShell
	tabs={['Agenda', 'Calendar', 'Classes', 'Courses']}
	active={selected ? '' : tab}
	onSelect={(t) => {
		if (t === 'Agenda' || t === 'Calendar') tab = t;
		onSelect(null);
	}}
>
	<main class="min-h-0 flex-1 overflow-y-auto">
		{#if selected}
			<div class="border-b bg-background px-6 py-3">
				<Button variant="ghost" size="sm" onclick={() => onSelect(null)}>
					<ArrowLeftIcon class="size-4" />
					Back to {tab}
				</Button>
			</div>
			<div class="px-6 py-8">
				<SessionBody occasion={selected} layout="wide" />
			</div>
		{:else if tab === 'Agenda'}
			<div class="px-6 py-6">
				<AgendaList rows={data.rows} today={data.today} onOpen={onSelect} />
			</div>
		{:else}
			<div class="px-6 py-6">
				<WeekGrid week={data.week} prev={data.prev} next={data.next} {onNav} onOpen={onSelect} />
			</div>
		{/if}
	</main>
</SessionShell>
