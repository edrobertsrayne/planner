<!--
	PROTOTYPE ONLY — issue #307 "How should the Planning screen be laid out?" Four variants,
	switchable via `?variant=A|B|C|D`, on fake data held in memory. Draft/Planned writes are local
	and lost on reload. The app shell is the one chosen in issue #305 (sidebar).
-->
<script lang="ts">
	import { page } from '$app/state';
	import PrototypeSwitcher from '$lib/components/prototype-switcher.svelte';
	import LessonStub from './prototype/LessonStub.svelte';
	import PlanningA from './prototype/PlanningA.svelte';
	import PlanningB from './prototype/PlanningB.svelte';
	import PlanningC from './prototype/PlanningC.svelte';
	import PlanningD from './prototype/PlanningD.svelte';
	import { lessonParam, store } from './prototype/store.svelte';

	const VARIANTS = [
		{ key: 'A', label: 'One list, grouped by week' },
		{ key: 'B', label: 'Full-width table' },
		{ key: 'C', label: 'Draft and Planned lanes' },
		{ key: 'D', label: 'Class rail, list, preview' }
	];
	const variant = $derived(page.url.searchParams.get('variant') ?? 'A');
	const Variant = $derived(
		(
			{ A: PlanningA, B: PlanningB, C: PlanningC, D: PlanningD } as Record<string, typeof PlanningA>
		)[variant] ?? PlanningA
	);
	const lesson = $derived(store.lessons.find((l) => l.id === lessonParam()) ?? null);
</script>

<svelte:head><title>Planning (prototype {variant})</title></svelte:head>

{#if lesson}
	<LessonStub {lesson} />
{:else}
	<Variant />
{/if}

<PrototypeSwitcher variants={VARIANTS} current={variant} />
