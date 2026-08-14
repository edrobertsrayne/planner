<script lang="ts">
	// PROTOTYPE — throwaway route answering issue #23: what do the screens for
	// setting up a Class, entering its timetable, and giving it its next Topic
	// look like? Three structurally different variants on one route, switchable
	// via ?variant= and the floating bar.
	//
	// The question is not "how do I CRUD a Class". It is: sit down in the first
	// week of September with the school's timetable sheet and get a fortnight of
	// periods into the thing without wanting to stop — and then, in November,
	// give a Class its next Topic in three seconds flat. The three variants
	// disagree about what the timetable *is*:
	//
	//   A  one canvas, all Classes — Classes are paint, the fortnight is the page
	//   B  no canvas at all — each Class owns its own grid, on its own page
	//   C  a transcription — a grid of text boxes, and typing a new label
	//      creates the Class, so the timetable comes before the Course
	//
	// They also disagree about where Assign Topic lives: on the Class card (A),
	// inside the Class page as a shelf (B), or in a keyboard modal from a dense
	// table (C).
	//
	// All three share one in-memory store, so a Class created in one is there in
	// the next. No database, no persistence, no auth. Delete this directory when
	// #23 closes.
	import { page } from '$app/state';
	import PrototypeSwitcher from './PrototypeSwitcher.svelte';
	import VariantA from './VariantA.svelte';
	import VariantB from './VariantB.svelte';
	import VariantC from './VariantC.svelte';

	const variants = [
		{ key: 'A', name: 'One fortnight, painted' },
		{ key: 'B', name: 'The Class is the page' },
		{ key: 'C', name: 'Transcribe it — typed grid' }
	];

	const variant = $derived(page.url.searchParams.get('variant') ?? 'A');
</script>

<svelte:head><title>PROTOTYPE — Class, timetable and Assign Topic (#23)</title></svelte:head>

{#if variant === 'B'}
	<VariantB />
{:else if variant === 'C'}
	<VariantC />
{:else}
	<VariantA />
{/if}

<PrototypeSwitcher {variants} />
