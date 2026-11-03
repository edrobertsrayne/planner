<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import type { Snippet } from 'svelte';
	import { createdId, failureReason } from '$lib/client/enhance';
	import { EVENT_KINDS, kindLabel } from '$lib/events';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Button } from '$lib/components/ui/button/index.js';

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
				<Field.Field>
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
				</Field.Field>

				<Field.Field>
					<Field.Label for="new-event-kind">Kind</Field.Label>
					<Select.Root type="single" name="kind" bind:value={kind}>
						<Select.Trigger size="sm" id="new-event-kind" class="w-full">
							{kindLabel(kind)}
						</Select.Trigger>
						<Select.Content>
							{#each EVENT_KINDS as k (k.value)}
								<Select.Item value={k.value} label={k.label} />
							{/each}
						</Select.Content>
					</Select.Root>
				</Field.Field>
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
