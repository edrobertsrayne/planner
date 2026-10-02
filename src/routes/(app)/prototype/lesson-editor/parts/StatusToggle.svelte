<script lang="ts">
	import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';
	import type { FakeLesson } from '../fake.svelte';

	let { lesson, class: className }: { lesson: FakeLesson; class?: string } = $props();
</script>

<ToggleGroup.Root
	type="single"
	variant="outline"
	size="sm"
	value={lesson.status}
	onValueChange={(v) => {
		if (v === 'draft' || v === 'planned') lesson.status = v;
	}}
	class="justify-start {className ?? ''}"
>
	<ToggleGroup.Item value="draft">Draft</ToggleGroup.Item>
	<ToggleGroup.Item value="planned">Planned</ToggleGroup.Item>
</ToggleGroup.Root>
