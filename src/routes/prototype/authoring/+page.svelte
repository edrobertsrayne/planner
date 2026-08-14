<script lang="ts">
	// PROTOTYPE — throwaway route answering issue #22: what do the Course, Topic
	// and Lesson authoring screens look like? Three structurally different
	// variants on one route, switchable via ?variant= and the floating bar.
	//
	// The question they exist to settle is not "how do I manage a tree". It is:
	// sit down on a Sunday and write next half-term's Topic — a dozen Lesson
	// titles, in one go. Each variant makes a different bet on how that goes, and
	// each answers "where does authoring live in the app" differently:
	//
	//   A  a fourth tab, peer of the reading views       — content is browsed
	//   B  no new tab; the Classes tab deepens           — content is approached
	//                                                      through the Class
	//   C  no tab at all; a compose overlay              — content is an activity
	//
	// All three share one in-memory content store, so titles typed in one variant
	// are there in the next. No database, no persistence, no auth. Delete this
	// directory when #22 closes.
	import { page } from '$app/state';
	import PrototypeSwitcher from './PrototypeSwitcher.svelte';
	import VariantA from './VariantA.svelte';
	import VariantB from './VariantB.svelte';
	import VariantC from './VariantC.svelte';

	const variants = [
		{ key: 'A', name: 'Courses tab — three-pane browser' },
		{ key: 'B', name: 'Topic as a document, reached from the Class' },
		{ key: 'C', name: 'Compose overlay — bulk entry' }
	];

	const variant = $derived(page.url.searchParams.get('variant') ?? 'A');
</script>

<svelte:head><title>PROTOTYPE — Course, Topic and Lesson authoring (#22)</title></svelte:head>

{#if variant === 'B'}
	<VariantB />
{:else if variant === 'C'}
	<VariantC />
{:else}
	<VariantA />
{/if}

<PrototypeSwitcher {variants} />
