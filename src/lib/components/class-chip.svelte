<script lang="ts">
	import { resolve } from '$app/paths';
	import { classTone } from '$lib/class-tone';
	import { touchTarget } from '$lib/ui';

	// A Class's label in its Tone, opening the Class's page.
	let { classId, label, tone }: { classId: string; label: string; tone: number } = $props();

	const colours = $derived(classTone(tone));
</script>

<a
	href={resolve(`/classes/${classId}`)}
	class="inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold whitespace-nowrap hover:brightness-95 dark:hover:brightness-125 {touchTarget}"
	style:background-color={colours.bg}
	style:color={colours.fg}
>
	{label}
</a>
