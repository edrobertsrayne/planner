<script lang="ts">
	import { enhance } from '$app/forms';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { submitWithValue } from '$lib/client/enhance';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import type { TopicOption } from '$lib/server/planner';

	let {
		classId,
		topics,
		submit,
		label
	}: {
		classId: string;
		topics: TopicOption[];
		// What the form does with the result: the Class page refreshes in place, the Classes screen toasts.
		submit: SubmitFunction;
		// The button's accessible name when several menus share a screen; the visible text stays "Assign Topic".
		label?: string;
	} = $props();
	let form = $state<HTMLFormElement | undefined>();
</script>

<form method="POST" action="?/assignTopic" bind:this={form} use:enhance={submit}>
	<input type="hidden" name="classId" value={classId} />
	<input type="hidden" name="topicId" />
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<Button {...props} variant="outline" size="sm" class="h-7 text-xs" aria-label={label}>
					<PlusIcon data-icon="inline-start" />Assign Topic
				</Button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end" class="w-auto min-w-(--bits-dropdown-menu-anchor-width)">
			{#each topics as topic (topic.id)}
				{@const all = topic.counted === topic.lessonCount}
				<DropdownMenu.Item
					class="whitespace-nowrap"
					disabled={all}
					onSelect={() => submitWithValue(form, 'topicId', topic.id)}
				>
					{topic.name} ·
					{all ? 'all' : `${topic.counted} of ${topic.lessonCount}`} in Sequence or Placed
				</DropdownMenu.Item>
			{:else}
				<DropdownMenu.Item class="whitespace-nowrap" disabled>
					This Course has no Topics yet.
				</DropdownMenu.Item>
			{/each}
		</DropdownMenu.Content>
	</DropdownMenu.Root>
</form>
