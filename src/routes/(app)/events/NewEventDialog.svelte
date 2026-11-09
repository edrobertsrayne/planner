<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from '$lib/ui/toast';
	import type { Snippet } from 'svelte';
	import { createdId, failureReason } from '$lib/client/enhance';
	import { EVENT_KINDS } from '$lib/events';
	import * as Dialog from '$lib/ui/dialog';
	import * as Field from '$lib/ui/field';
	import { Button, Input, Select } from '$lib/ui';

	let { trigger }: { trigger: Snippet<[props: Record<string, unknown>]> } = $props();

	let name = $state('');
	let kind = $state<string>('meeting');
</script>

<Dialog.Root>
	<Dialog.Trigger>
		{#snippet child({ props })}
			{@render trigger(props)}
		{/snippet}
	</Dialog.Trigger>

	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>New Event</Dialog.Title>
			<Dialog.Description>
				A commitment that repeats and is not a lesson. The kind is only a label.
			</Dialog.Description>
		</Dialog.Header>

		<form
			method="POST"
			action="?/createEvent"
			use:enhance={() => {
				// A new Event opens on its own page, to be placed — so this navigates rather than
				// refreshing the list behind the dialog.
				return async ({ result }) => {
					const id = createdId(result, 'event');
					if (id !== null) {
						name = '';
						await goto(resolve(`/events/${id}`));
					} else if (result.type === 'failure') {
						toast.error(failureReason(result, 'Could not create the Event.'));
					}
				};
			}}
		>
			<Field.Group>
				<Field.Root>
					<Field.Label for="new-event-name">Name</Field.Label>
					<Input
						id="new-event-name"
						name="name"
						bind:value={name}
						required
						autocomplete="off"
						placeholder="Y11 intervention"
						class="h-7"
					/>
				</Field.Root>

				<Field.Root>
					<Field.Label for="new-event-kind">Kind</Field.Label>
					<Select
						name="kind"
						id="new-event-kind"
						bind:value={kind}
						options={EVENT_KINDS}
						class="w-full"
					/>
				</Field.Root>
			</Field.Group>

			<Dialog.Footer class="mt-6">
				<Dialog.Close>
					{#snippet child({ props })}
						<Button {...props} variant="ghost" size="sm">Cancel</Button>
					{/snippet}
				</Dialog.Close>
				<Button type="submit" size="sm">Create Event</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
