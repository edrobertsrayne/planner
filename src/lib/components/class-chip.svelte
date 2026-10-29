<script lang="ts">
	import { resolve } from '$app/paths';
	import { classTone } from '$lib/class-tone';
	import { touchTarget } from '$lib/components/ui/touch-target';

	// A Class's label in its Tone, opening the Class's page.
	let { classId, label, tone }: { classId: string; label: string; tone: number } = $props();

	const colours = $derived(classTone(tone));
</script>

<a
	href={resolve(`/classes/${classId}`)}
	class="rounded-2xl px-2 py-0.5 text-xs font-medium whitespace-nowrap outline-none hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring dark:hover:brightness-125 {touchTarget}"
	style:background-color={colours.bg}
	style:color={colours.fg}
>
	{label}
</a>
