<!--
	PROTOTYPE — throwaway. C — Sheet over the schedule, URL-driven.

	The hybrid. Selection is in the URL exactly as in B, so a Session is still linkable and still
	survives a reload — but it presents as a shadcn Sheet sliding in over the right of the screen
	instead of taking the whole page. The schedule keeps its full width underneath and is never
	squeezed; it just isn't interactive while the Sheet is up (overlay, focus trap, Escape closes).

	Judge against A: is "the schedule is visible but inert behind an overlay" enough, or is the
	whole point of the aside that you can click the *next* occasion without dismissing first?
	And against B: does a Session deserve a whole screen, or is a 420px panel the right size for
	a title, a plan and a note?
-->
<script lang="ts">
	import * as Sheet from '$lib/components/ui/sheet/index.js';
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
	active={tab}
	onSelect={(t) => {
		if (t === 'Agenda' || t === 'Calendar') tab = t;
	}}
>
	<main class="min-h-0 flex-1 overflow-y-auto px-6 py-6">
		{#if tab === 'Agenda'}
			<AgendaList rows={data.rows} today={data.today} onOpen={onSelect} {selected} />
		{:else}
			<WeekGrid
				week={data.week}
				prev={data.prev}
				next={data.next}
				{onNav}
				onOpen={onSelect}
				{selected}
			/>
		{/if}
	</main>
</SessionShell>

<Sheet.Root open={!!selected} onOpenChange={(open) => !open && onSelect(null)}>
	<Sheet.Content side="right" class="w-full gap-0 overflow-y-auto px-5 py-5 sm:max-w-[420px]">
		<Sheet.Header class="sr-only">
			<Sheet.Title>Session</Sheet.Title>
			<Sheet.Description>The Lesson planned for this occasion, and how it went.</Sheet.Description>
		</Sheet.Header>
		{#if selected}
			<SessionBody occasion={selected} />
		{/if}
	</Sheet.Content>
</Sheet.Root>
