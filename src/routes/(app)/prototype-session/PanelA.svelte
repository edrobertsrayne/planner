<!--
	PROTOTYPE ONLY (issue #311). Variant A: a side panel, today's model tidied. On a laptop it sits
	in the flow beside the screen, full height, scrolling on its own; nothing behind it is covered.
	On a tablet it slides over the right of the screen with no backdrop. On a phone it covers the
	screen under the top bar; a bar at the foot jumps to the note.
-->
<script lang="ts">
	import PencilIcon from '@lucide/svelte/icons/pencil-line';
	import NoteBox from './NoteBox.svelte';
	import OccasionControls from './OccasionControls.svelte';
	import PlanBody from './PlanBody.svelte';
	import SessionHeader from './SessionHeader.svelte';
	import { close, type Detail } from './store.svelte';

	let { d }: { d: Detail } = $props();

	function toNote() {
		const el = document.getElementById('session-note');
		el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		el?.querySelector<HTMLElement>('[contenteditable]')?.focus();
	}
</script>

<aside
	class="fixed inset-x-0 top-14 bottom-0 z-30 flex flex-col border-l bg-card md:top-0 md:left-auto md:w-96 md:shadow-xl lg:sticky lg:h-screen lg:w-[26rem] lg:shrink-0 lg:shadow-none"
	aria-label="Session"
>
	<div class="min-h-0 flex-1 overflow-y-auto p-5">
		<SessionHeader {d} onclose={close} />
		<div class="mt-5"><PlanBody {d} /></div>
		{#if d.row.lesson || d.canPlace}
			<div class="mt-6"><OccasionControls {d} only="continuation" /></div>
			<div class="mt-4"><OccasionControls {d} only="place" /></div>
		{/if}
		<hr class="my-5" />
		<NoteBox {d} />
		{#if d.placed}
			<div class="mt-4"><OccasionControls {d} only="remove" /></div>
		{/if}
		<div class="h-16 md:hidden"></div>
	</div>
	<div class="border-t bg-card p-2 md:hidden">
		<button
			type="button"
			class="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-foreground"
			onclick={toNote}
		>
			<PencilIcon class="size-4" /> Write a note
		</button>
	</div>
</aside>
