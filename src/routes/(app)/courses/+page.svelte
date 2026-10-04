<!--
	PROTOTYPE ONLY — issue #306 "How do the Courses screen and its pages divide Courses, Topics and
	Lessons?" Four variants, switchable via `?variant=A|B|C|D`, on fake data held in memory. Every
	write is local and lost on reload. The app shell is the one chosen in issue #305 (sidebar).
-->
<script lang="ts">
	import { page } from '$app/state';
	import PrototypeSwitcher from '$lib/components/prototype-switcher.svelte';
	import CoursesA from './prototype/CoursesA.svelte';
	import CoursesB from './prototype/CoursesB.svelte';
	import CoursesC from './prototype/CoursesC.svelte';
	import CoursesD from './prototype/CoursesD.svelte';
	import LessonStub from './prototype/LessonStub.svelte';
	import { current, to } from './prototype/store.svelte';

	const VARIANTS = [
		{ key: 'A', label: 'Tiles, then Topics beside Lessons' },
		{ key: 'A1', label: 'A + Course Tone as a band' },
		{ key: 'A2', label: 'A + Course Tone as a dot' },
		{ key: 'A3', label: 'A + each Class in its Tone' },
		{ key: 'B', label: 'Tiles, Course page, Topic page' },
		{ key: 'C', label: 'Course switcher, one outline' },
		{ key: 'D', label: 'One screen, Course tree' }
	];
	const COLOURS = { A1: 'band', A2: 'dot', A3: 'classes' } as const;
	const variant = $derived(page.url.searchParams.get('variant') ?? 'A');
	const Variant = $derived(
		({ B: CoursesB, C: CoursesC, D: CoursesD } as Record<string, typeof CoursesB>)[variant] ?? null
	);
</script>

<svelte:head><title>Courses (prototype {variant})</title></svelte:head>

{#if current.course && current.topic && current.lesson}
	<LessonStub
		course={current.course}
		topic={current.topic}
		lesson={current.lesson}
		back={to({ course: current.course.id, topic: current.topic.id })}
	/>
{:else if Variant}
	<Variant />
{:else}
	<CoursesA colour={COLOURS[variant as keyof typeof COLOURS] ?? 'none'} />
{/if}

<PrototypeSwitcher variants={VARIANTS} current={variant} />
