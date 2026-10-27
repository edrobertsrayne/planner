<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import type { Snippet } from 'svelte';
	import { createdId, failureReason } from '$lib/client/enhance';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Button } from '$lib/components/ui/button/index.js';

	let { trigger }: { trigger: Snippet<[props: Record<string, unknown>]> } = $props();

	let name = $state('');
</script>

<Dialog.Root>
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
					const id = createdId(result, 'course');
					if (id !== null) {
						name = '';
						await goto(resolve(`/courses/${id}`));
					} else if (result.type === 'failure') {
						toast.error(failureReason(result, 'Could not create the Course.'));
					}
				};
			}}
		>
			<Field.Group>
				<Field.Field>
					<Field.Label for="new-course-name">Name</Field.Label>
					<Input
						id="new-course-name"
						name="name"
						bind:value={name}
						required
						autocomplete="off"
						placeholder="Year 9 Physics"
						class="h-7"
					/>
				</Field.Field>
			</Field.Group>

			<Dialog.Footer class="mt-6">
				<Dialog.Close>
					{#snippet child({ props })}
						<Button {...props} variant="ghost" size="sm">Cancel</Button>
					{/snippet}
				</Dialog.Close>
				<Button type="submit" size="sm">Create Course</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
