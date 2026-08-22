<!--
	PROTOTYPE — throwaway. Issue #63: what do the Classes screens look like?

	Two screens (`?screen=list` and `?screen=detail`), three variants each (`?variant=A|B|C`),
	switchable from the floating bar. The three detail variants disagree about the screen split,
	about the Slot grid, and about how "this timetable, from this date" is expressed — the three
	questions the ticket asks — so they must be judged as wholes, not as a menu of parts.

	Runs on fixtures: no database, no login. See ./fixtures.ts.
-->
<script lang="ts">
	import { page } from '$app/state';
	import ClassesShell from './ClassesShell.svelte';
	import PrototypeSwitcher from './PrototypeSwitcher.svelte';
	import ListA from './ListA.svelte';
	import ListB from './ListB.svelte';
	import ListC from './ListC.svelte';
	import ListD from './ListD.svelte';
	import DetailA from './DetailA.svelte';
	import DetailB from './DetailB.svelte';
	import DetailC from './DetailC.svelte';
	import DetailD from './DetailD.svelte';
	import DetailE from './DetailE.svelte';

	const SCREENS = {
		list: {
			variants: [
				{ key: 'A', name: 'Lane cards', component: ListA },
				{ key: 'B', name: 'The register', component: ListB },
				{ key: 'C', name: 'Launcher tiles', component: ListC },
				{ key: 'D', name: 'Tiles + actions', component: ListD }
			]
		},
		detail: {
			variants: [
				{ key: 'A', name: 'One page, sectioned', component: DetailA },
				{ key: 'B', name: 'Identity + tabs', component: DetailB },
				{ key: 'C', name: 'The workbench', component: DetailC },
				{ key: 'D', name: 'Workbench + one week', component: DetailD },
				{ key: 'E', name: 'Workbench + both weeks', component: DetailE }
			]
		}
	} as const;

	const screen = $derived(page.url.searchParams.get('screen') === 'detail' ? 'detail' : 'list');
	const variants = $derived(SCREENS[screen].variants);
	const key = $derived(
		variants.some((v) => v.key === page.url.searchParams.get('variant'))
			? page.url.searchParams.get('variant')!
			: 'A'
	);
	const Variant = $derived(variants.find((v) => v.key === key)!.component);
</script>

<svelte:head><title>Prototype — Classes screens</title></svelte:head>

<ClassesShell>
	<Variant />
</ClassesShell>

<PrototypeSwitcher
	{screen}
	variants={variants.map(({ key, name }) => ({ key, name }))}
	current={key}
/>
