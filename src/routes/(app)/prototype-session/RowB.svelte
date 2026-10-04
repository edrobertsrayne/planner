<!--
	PROTOTYPE ONLY (issue #311). Variant B: the Session opens in its own row. No panel: the row on
	the Agenda grows to show the plan and the note, and one row is open at a time. On a laptop the
	plan is on the left and the note on the right. On a phone they stack; a Session that has started
	shows the note first. The Calendar cannot grow a cell like this, so it would need one of the
	other variants as well.
-->
<script lang="ts">
	import NoteBox from './NoteBox.svelte';
	import OccasionControls from './OccasionControls.svelte';
	import PlanBody from './PlanBody.svelte';
	import SessionHeader from './SessionHeader.svelte';
	import type { Detail } from './store.svelte';

	let { d }: { d: Detail } = $props();
</script>

<div class="bg-muted/30 px-4 py-4 md:px-5">
	<div class="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
		<div class={d.started ? 'order-2 lg:order-1' : ''}>
			<SessionHeader {d} linkOnly />
			<div class="mt-4"><PlanBody {d} /></div>
			<div class="mt-5"><OccasionControls {d} only="continuation" /></div>
		</div>
		<div class="space-y-4 {d.started ? 'order-1 lg:order-2' : ''}">
			<NoteBox {d} />
			<OccasionControls {d} only="place" />
			<OccasionControls {d} only="remove" />
		</div>
	</div>
</div>
