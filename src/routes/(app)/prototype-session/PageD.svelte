<!--
	PROTOTYPE ONLY (issue #311). Variant D: a Session page, like the Lesson editor. The Session takes
	the screen; Back returns to where it was opened. On a laptop the plan is on the left and a rail
	on the right holds the note and the acts on the occasion. Below `lg` it is one column; a Session
	that has started puts the note first. The real page would have its own address, such as
	/sessions/10X/2026-10-05/2; the prototype keeps it on the Agenda's URL.
-->
<script lang="ts">
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import NoteBox from './NoteBox.svelte';
	import OccasionControls from './OccasionControls.svelte';
	import PlanBody from './PlanBody.svelte';
	import SessionHeader from './SessionHeader.svelte';
	import { close, type Detail } from './store.svelte';

	let { d }: { d: Detail } = $props();
</script>

<div class="mx-auto max-w-6xl px-4 py-4 md:px-6 md:py-6">
	<button
		type="button"
		class="-ml-2 inline-flex h-11 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground md:h-8"
		onclick={close}
	>
		<ArrowLeftIcon class="size-4" /> Agenda
	</button>
	<div class="mt-3"><SessionHeader {d} big /></div>

	<div class="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
		<section class={d.started ? 'order-2 lg:order-1' : ''}>
			<h3 class="mb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
				Plan
			</h3>
			<PlanBody {d} />
		</section>
		<aside class="space-y-5 {d.started ? 'order-1 lg:order-2' : ''}">
			<div class="rounded-xl border bg-card p-4"><NoteBox {d} /></div>
			{#if d.row.lesson || d.canPlace || d.placed}
				<div class="rounded-xl border bg-card p-4"><OccasionControls {d} /></div>
			{/if}
		</aside>
	</div>
</div>
