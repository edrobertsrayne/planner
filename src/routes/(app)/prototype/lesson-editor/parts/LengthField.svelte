<script lang="ts">
	import { Input } from '$lib/components/ui/input/index.js';
	import type { FakeLesson } from '../fake.svelte';

	let { lesson }: { lesson: FakeLesson } = $props();
</script>

<span class="flex items-center gap-2">
	<Input
		type="number"
		min="1"
		max="20"
		bind:value={lesson.length}
		class="h-7 w-16"
		aria-label="Length"
	/>
	<span class="text-sm text-muted-foreground">Period{lesson.length === 1 ? '' : 's'}</span>
</span>
