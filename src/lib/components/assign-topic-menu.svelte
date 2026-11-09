<script lang="ts">
	import { enhance } from '$app/forms';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { submitForm } from '$lib/client/enhance';
	import { Button } from '$lib/ui';
	import * as DropdownMenu from '$lib/ui/menu';
	import type { TopicOption } from '$lib/server/planner';

	let {
		classId,
		topics,
		submit,
		label,
		onTile = false
	}: {
		classId: string;
		topics: TopicOption[];
		// What the form does with the result: the Class page refreshes in place, the Classes screen toasts.
		submit: SubmitFunction;
		// The button's accessible name when several menus share a screen; the visible text stays "Assign Topic".
		label?: string;
		// On a Tone-filled Class tile the button is a translucent chip, not a primary-container one.
		onTile?: boolean;
	} = $props();
	let form = $state<HTMLFormElement | undefined>();
</script>

<form method="POST" action="?/assignTopic" bind:this={form} use:enhance={submit}>
	<input type="hidden" name="classId" value={classId} />
	<input type="hidden" name="topicId" />
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<Button
					{...props}
					variant={onTile ? 'ghost' : 'secondary'}
					size="sm"
					class="h-9 {onTile
						? 'bg-white/60 hover:bg-white dark:bg-white/10 dark:hover:bg-white/20'
						: ''}"
					aria-label={label}
				>
					<PlusIcon data-icon="inline-start" />Assign Topic<ChevronDownIcon
						data-icon="inline-end"
					/>
				</Button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end">
			{#each topics as topic (topic.id)}
				{@const all = topic.counted === topic.lessonCount}
				<DropdownMenu.Item
					class="whitespace-nowrap"
					disabled={all}
					onSelect={() => submitForm(form, { fields: { topicId: topic.id } })}
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
