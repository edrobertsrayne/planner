<!--
	PROTOTYPE ONLY (issue #311). Variant C: a sheet with tabs. On a laptop and a tablet a wide sheet
	slides in from the right over a dimmed screen; on a phone it rises from the bottom, nearly full
	height. Three tabs — Plan, How it went, This occasion — so each part has the whole height. A
	Session that has started opens on How it went; one ahead opens on Plan.
-->
<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';
	import * as Sheet from '$lib/components/ui/sheet';
	import NoteBox from './NoteBox.svelte';
	import OccasionControls from './OccasionControls.svelte';
	import PlanBody from './PlanBody.svelte';
	import SessionHeader from './SessionHeader.svelte';
	import { notes } from '../prototype-agenda/store.svelte';
	import { close, type Detail } from './store.svelte';

	let { d }: { d: Detail | null } = $props();
	const wide = new MediaQuery('min-width: 768px');

	type Tab = 'plan' | 'note' | 'occasion';
	let tab = $state<Tab>('plan');
	let lastKey = '';
	$effect.pre(() => {
		if (d && d.row.key !== lastKey) {
			lastKey = d.row.key;
			tab = d.started ? 'note' : 'plan';
		}
	});
	const tabs = $derived([
		['plan', 'Plan'],
		['note', notes[d?.row.key ?? ''] ? 'How it went •' : 'How it went'],
		['occasion', 'This occasion']
	] as [Tab, string][]);
</script>

<Sheet.Root
	open={!!d}
	onOpenChange={(o) => {
		if (!o) close();
	}}
>
	<Sheet.Content
		side={wide.current ? 'right' : 'bottom'}
		showCloseButton={false}
		class="gap-0 data-[side=bottom]:h-[92dvh] data-[side=bottom]:rounded-t-xl data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
	>
		{#if d}
			<div class="mx-auto mt-2 h-1.5 w-10 rounded-full bg-muted md:hidden"></div>
			<div class="border-b px-5 pt-3 pb-0 md:pt-5">
				<Sheet.Title class="sr-only">Session</Sheet.Title>
				<SessionHeader {d} onclose={close} />
				<div class="mt-4 flex text-sm" role="tablist">
					{#each tabs as [key, label] (key)}
						<button
							type="button"
							role="tab"
							aria-selected={tab === key}
							class="-mb-px h-11 flex-1 border-b-2 px-3 font-medium whitespace-nowrap md:h-9 md:flex-none {tab ===
							key
								? 'border-primary text-foreground'
								: 'border-transparent text-muted-foreground hover:text-foreground'}"
							onclick={() => (tab = key)}>{label}</button
						>
					{/each}
				</div>
			</div>
			<div class="min-h-0 flex-1 overflow-y-auto p-5">
				{#if tab === 'plan'}
					<PlanBody {d} />
					{#if !d.row.lesson}
						<p class="text-sm text-muted-foreground">
							Nothing planned. Use <em>This occasion</em> to place a Lesson.
						</p>
					{/if}
				{:else if tab === 'note'}
					<NoteBox {d} heading={false} />
				{:else}
					<OccasionControls {d} />
					{#if !d.row.lesson && !d.canPlace}
						<p class="text-sm text-muted-foreground">Nothing to do on a past Open Slot.</p>
					{/if}
				{/if}
			</div>
		{/if}
	</Sheet.Content>
</Sheet.Root>
