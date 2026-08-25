<script lang="ts">
	import { dev } from '$app/environment';
	import { page } from '$app/state';
	import PageHeader from '$lib/components/page-header.svelte';
	import PrototypeSwitcher from '$lib/components/prototype-switcher.svelte';
	import LessonStub from './lesson-stub.svelte';
	import VariantSegmented from './variant-segmented.svelte';
	import VariantChips from './variant-chips.svelte';
	import VariantMarker from './variant-marker.svelte';
	import { mockLessons, type MockLesson, type Status } from './data';

	// Three takes on the restated Planning row (#108), switchable via ?variant= on
	// /prototype/planning. Everything but the row control is settled: the stream, the ordering,
	// the date block, the filter chips. State is in-memory and vanishes on reload.

	let lessons = $state<MockLesson[]>(mockLessons());
	let stubbed = $state<MockLesson | null>(null);
	const variant = $derived(page.url.searchParams.get('variant') ?? 'a');

	function setStatus(id: string, status: Status) {
		const lesson = lessons.find((l) => l.id === id);
		if (lesson) lesson.status = status;
	}
</script>

<svelte:head><title>Planning · PROTOTYPE</title></svelte:head>

<div class="mx-auto max-w-6xl px-6 py-6">
	<PageHeader
		title="Planning"
		description="PROTOTYPE — the restated row (#108). Readiness has gone to the Agenda; only Bare and Drafted remain. Flip with the bar below or the arrow keys; nothing saves."
	/>

	{#if variant === 'b'}
		<VariantChips {lessons} {setStatus} onOpen={(l) => (stubbed = l)} />
	{:else if variant === 'c'}
		<VariantMarker {lessons} {setStatus} onOpen={(l) => (stubbed = l)} />
	{:else}
		<VariantSegmented {lessons} {setStatus} onOpen={(l) => (stubbed = l)} />
	{/if}
</div>

{#if dev}
	<PrototypeSwitcher
		variants={[
			['a', 'A — Segmented control'],
			['b', 'B — Chip group (matches editor)'],
			['c', 'C — Left rail + single action']
		] as const}
	/>
{/if}

<LessonStub lesson={stubbed} {setStatus} onclose={() => (stubbed = null)} />
