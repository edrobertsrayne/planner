<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import type { Snippet } from 'svelte';
	import { createdId, failureReason } from '$lib/client/enhance';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Button } from '$lib/components/ui/button/index.js';

	let {
		courses,
		trigger
	}: {
		courses: { id: string; name: string }[];
		trigger: Snippet<[props: Record<string, unknown>]>;
	} = $props();

	let label = $state('');
	let courseId = $state('');

	$effect(() => {
		if (!courses.some((c) => c.id === courseId)) courseId = courses[0]?.id ?? '';
	});
</script>

<Dialog.Root>
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
					const id = createdId(result, 'class');
					if (id !== null) {
						label = '';
						await goto(resolve(`/classes/${id}`));
					} else if (result.type === 'failure') {
						toast.error(failureReason(result, 'Could not create the Class.'));
					}
				};
			}}
		>
			<Field.Group>
				<Field.Field>
					<Field.Label for="new-class-label">Label</Field.Label>
					<Input
						id="new-class-label"
						name="label"
						bind:value={label}
						required
						autocomplete="off"
						placeholder="9B/Sc1"
						class="h-7"
					/>
					<Field.Description>However it appears on your timetable.</Field.Description>
				</Field.Field>

				<Field.Field>
					<Field.Label for="new-class-course">Course</Field.Label>
					<Select.Root type="single" name="courseId" bind:value={courseId}>
						<Select.Trigger size="sm" id="new-class-course" class="w-full">
							{courses.find((c) => c.id === courseId)?.name ?? 'Pick a Course'}
						</Select.Trigger>
						<Select.Content>
							{#each courses as course (course.id)}
								<Select.Item value={course.id} label={course.name} />
							{/each}
						</Select.Content>
					</Select.Root>
					<Field.Description>
						A mis-pick means deleting the Class and starting again.
					</Field.Description>
				</Field.Field>
			</Field.Group>

			<Dialog.Footer class="mt-6">
				<Dialog.Close>
					{#snippet child({ props })}
						<Button {...props} variant="ghost" size="sm">Cancel</Button>
					{/snippet}
				</Dialog.Close>
				<Button type="submit" size="sm">Create Class</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
