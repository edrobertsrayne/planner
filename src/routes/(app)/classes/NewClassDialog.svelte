<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';
	import { createdId, failureReason } from '$lib/client/enhance';
	import * as Dialog from '$lib/ui/dialog';
	import * as Field from '$lib/ui/field';
	import { Button, Input, Select } from '$lib/ui';

	let {
		courses,
		trigger
	}: {
		courses: { id: string; name: string }[];
		trigger: Snippet<[props: Record<string, unknown>]>;
	} = $props();

	let label = $state('');

	// A refusal is named in the dialog: a toast would sit behind the modal's inert page.
	let error = $state<string | null>(null);
	let pickedCourseId = $state('');

	// The first Course stands in until the teacher picks another: a Class needs one, and the
	// list cannot change while the dialog is open.
	const courseOptions = $derived(courses.map((c) => ({ value: c.id, label: c.name })));
	const course = $derived(courses.find((c) => c.id === pickedCourseId) ?? courses[0]);
</script>

<Dialog.Root onOpenChange={() => (error = null)}>
	<Dialog.Trigger>
		{#snippet child({ props })}
			{@render trigger(props)}
		{/snippet}
	</Dialog.Trigger>

	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>New Class</Dialog.Title>
			<Dialog.Description>
				The Course is fixed at creation and cannot be changed later.
			</Dialog.Description>
		</Dialog.Header>

		<form
			method="POST"
			action="?/createClass"
			use:enhance={() => {
				// A new Class opens on its own page, to be timetabled — so this navigates rather than
				// refreshing the list behind the dialog.
				return async ({ result }) => {
					error = null;
					const id = createdId(result, 'class');
					if (id !== null) {
						label = '';
						await goto(resolve(`/classes/${id}`));
					} else if (result.type === 'failure') {
						error = failureReason(result, 'Could not create the Class.');
					}
				};
			}}
		>
			<Field.Group>
				<Field.Root>
					<Field.Label for="new-class-label">Label</Field.Label>
					<Input
						id="new-class-label"
						name="label"
						bind:value={label}
						required
						autocomplete="off"
						placeholder="9B/Sc1"
					/>
					<Field.Description>However it appears on your timetable.</Field.Description>
				</Field.Root>

				<Field.Root>
					<Field.Label for="new-class-course">Course</Field.Label>
					<Select
						name="courseId"
						id="new-class-course"
						value={course?.id ?? ''}
						onValueChange={(id) => (pickedCourseId = id)}
						options={courseOptions}
						class="w-full"
					/>
					<Field.Description>
						A mis-pick means deleting the Class and starting again.
					</Field.Description>
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
				<Button type="submit">Create Class</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
