<!-- PROTOTYPE ONLY (issue #307): a Class label in its Tone. -->
<script lang="ts">
	import { classTone } from '$lib/class-tone';

	let { label, tone }: { label: string; tone: number } = $props();
	const t = $derived(classTone(tone));
</script>

<span
	class="inline-block rounded-2xl px-2 py-0.5 text-xs font-medium whitespace-nowrap"
	style:background-color={t.bg}
	style:color={t.fg}
>
	{label}
</span>
