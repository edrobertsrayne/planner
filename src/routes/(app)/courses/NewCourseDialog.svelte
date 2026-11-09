<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';
	import { createdId, failureReason } from '$lib/client/enhance';
	import * as Dialog from '$lib/ui/dialog';
	import * as Field from '$lib/ui/field';
	import { Button, Input } from '$lib/ui';

	let { trigger }: { trigger: Snippet<[props: Record<string, unknown>]> } = $props();

	let name = $state('');

	// A refusal is named in the dialog: a toast would sit behind the modal's inert page.
	let error = $state<string | null>(null);
</script>

<Dialog.Root onOpenChange={() => (error = null)}>
	<Dialog.Trigger>
		{#snippet child({ props })}
			{@render trigger(props)}
		{/snippet}
	</Dialog.Trigger>

	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>New Course</Dialog.Title>
		</Dialog.Header>

		<form
			method="POST"
			action="?/createCourse"
			use:enhance={() => {
				// A new Course opens on its own page, to be given Topics — so this navigates rather than
				// refreshing the list behind the dialog.
				return async ({ result }) => {
					error = null;
					const id = createdId(result, 'course');
					if (id !== null) {
						name = '';
						await goto(resolve(`/courses/${id}`));
					} else if (result.type === 'failure') {
						error = failureReason(result, 'Could not create the Course.');
					}
				};
			}}
		>
			<Field.Group>
				<Field.Root>
					<Field.Label for="new-course-name">Name</Field.Label>
					<Input
						id="new-course-name"
						name="name"
						bind:value={name}
						required
						autocomplete="off"
						placeholder="Year 9 Physics"
					/>
				</Field.Root>
			</Field.Group>

			{#if error}
				<p role="alert" class="mt-3 text-xs text-destructive">{error}</p>
			{/if}

			<Dialog.Footer class="mt-6">
				<Dialog.Close>
					{#snippet child({ props })}
						<Button {...props} variant="ghost">Cancel</Button>
					{/snippet}
				</Dialog.Close>
				<Button type="submit">Create Course</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
