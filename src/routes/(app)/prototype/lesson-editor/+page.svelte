<!--
	PROTOTYPE ONLY — issue #304 "How should the Lesson editor be presented and laid out?"
	Four variants of the Lesson editor, switchable via `?variant=A|B|C|D`, on the throwaway route
	/prototype/lesson-editor inside the real app shell. Fake in-memory data, auth guard off.
	Below 768px every variant shows the same phone read view.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import PrototypeSwitcher from '$lib/components/prototype-switcher.svelte';
	import { fakeAction, lessons } from './fake.svelte';
	import ReadView from './ReadView.svelte';
	import VariantA from './VariantA.svelte';
	import VariantB from './VariantB.svelte';
	import VariantC from './VariantC.svelte';
	import VariantD from './VariantD.svelte';

	const VARIANTS = [
		{ key: 'A', label: 'Document page' },
		{ key: 'B', label: 'Page + property rail' },
		{ key: 'C', label: 'Wide side panel' },
		{ key: 'D', label: 'Big modal with tabs' }
	];

	const variant = $derived(page.url.searchParams.get('variant') ?? 'A');

	// Stepping walks the Waves Topic, like today's editor walks its Topic.
	const sequence = $derived(lessons.filter((l) => l.topicId === 't2'));
	let currentId = $state('l5');
	let open = $state(true);
	const lesson = $derived(lessons.find((l) => l.id === currentId)!);
	const index = $derived(sequence.findIndex((l) => l.id === currentId));

	function onstep(delta: number) {
		const next = sequence[index + delta];
		if (next) currentId = next.id;
	}

	function onopen(id: string) {
		currentId = id;
		open = true;
	}

	let phone = $state(false);
	onMount(() => {
		const mq = window.matchMedia('(max-width: 767px)');
		phone = mq.matches;
		const on = () => (phone = mq.matches);
		mq.addEventListener('change', on);
		return () => mq.removeEventListener('change', on);
	});
	// The shell's content column is `overflow-y-auto` but never scrolls (the window does), which
	// traps `position: sticky` inside it. Lift that for this prototype only.
	onMount(() => {
		const column = document.querySelector<HTMLElement>('main > div');
		if (!column) return;
		column.style.overflowY = 'visible';
		return () => (column.style.overflowY = '');
	});

	let viewport = $state('');
	onMount(() => {
		const on = () => (viewport = `${window.innerWidth}×${window.innerHeight}`);
		on();
		window.addEventListener('resize', on);
		return () => window.removeEventListener('resize', on);
	});
</script>

<svelte:head><title>Prototype · Lesson editor</title></svelte:head>

{#if phone}
	<ReadView {lesson} index={Math.max(index, 0)} count={sequence.length} {onstep} />
{:else if variant === 'A'}
	<VariantA
		{lesson}
		index={Math.max(index, 0)}
		count={sequence.length}
		{onstep}
		onclose={() => fakeAction('return to the Courses screen')}
	/>
{:else if variant === 'B'}
	<VariantB
		{lesson}
		index={Math.max(index, 0)}
		count={sequence.length}
		{onstep}
		onclose={() => fakeAction('return to the Courses screen')}
	/>
{:else if variant === 'C'}
	<VariantC
		{lesson}
		{open}
		index={Math.max(index, 0)}
		count={sequence.length}
		{onstep}
		onclose={() => (open = false)}
		{onopen}
	/>
{:else}
	<VariantD
		{lesson}
		{open}
		index={Math.max(index, 0)}
		count={sequence.length}
		{onstep}
		onclose={() => (open = false)}
		{onopen}
	/>
{/if}

<span
	class="fixed right-2 bottom-2 z-50 rounded bg-black/80 px-2 py-0.5 font-mono text-[10px] text-white"
>
	{viewport}{phone ? ' · phone read view' : ''}
</span>

<PrototypeSwitcher variants={VARIANTS} current={variant} />
