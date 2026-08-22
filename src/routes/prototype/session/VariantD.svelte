<!--
	PROTOTYPE — throwaway. D — Dismissible aside. The A/C hybrid Ed asked for.

	Takes A's shape: a real in-flow column, so the schedule is squeezed rather than covered, stays
	fully interactive, and you can click straight from one occasion to the next. Takes C's exit:
	click anywhere off it and it closes, plus Escape.

	Three things make that combination work, and each is a decision in its own right:

	1. Session triggers are exempt. A click on an Agenda row or a grid cell carries
	   `data-session-trigger`, so the dismiss handler ignores it and the click *switches* Session
	   instead of closing then reopening. Without this the hybrid is unusable.
	2. It listens on `pointerdown`, not `click`, so dismissal feels immediate and lands before the
	   trigger's own click fires.
	3. No overlay and no focus trap — that is the whole point of not being a Sheet, and it keeps
	   ADR-0012's "must not overlay or trap focus" note satisfied.

	Selection is URL-carried, as in B and C, so this is also linkable and reload-stable — the one
	thing A can't do. That wasn't part of the ask; say if you'd rather it stayed store-only.
-->
<script lang="ts">
	import XIcon from '@lucide/svelte/icons/x';
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
	let asideEl = $state<HTMLElement | null>(null);

	$effect(() => {
		if (!selected) return;

		function onPointerDown(event: PointerEvent) {
			const target = event.target as HTMLElement | null;
			if (!target) return;
			if (asideEl?.contains(target)) return;
			// Let a trigger switch Sessions rather than dismissing this one first.
			if (target.closest('[data-session-trigger]')) return;
			// The prototype's own floating switcher isn't part of the design being judged.
			if (target.closest('[data-prototype-chrome]')) return;
			onSelect(null);
		}

		function onKeydown(event: KeyboardEvent) {
			if (event.key === 'Escape') onSelect(null);
		}

		window.addEventListener('pointerdown', onPointerDown);
		window.addEventListener('keydown', onKeydown);
		return () => {
			window.removeEventListener('pointerdown', onPointerDown);
			window.removeEventListener('keydown', onKeydown);
		};
	});
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
		</div>

		{#if selected}
			<aside
				bind:this={asideEl}
				class="w-96 shrink-0 overflow-y-auto border-l bg-card px-5 py-5"
				aria-label="Session"
			>
				<div class="mb-1 flex justify-end">
					<Button
						variant="ghost"
						size="sm"
						onclick={() => onSelect(null)}
						aria-label="Close Session"
					>
						<XIcon class="size-4" />
					</Button>
				</div>
				<SessionBody occasion={selected} />
			</aside>
		{/if}
	</main>
</SessionShell>
