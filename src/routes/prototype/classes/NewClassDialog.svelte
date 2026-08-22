<!--
	PROTOTYPE — throwaway. Creating a Class, moved out of the page body and into a Dialog. Today
	it is a three-control form wedged into the list header; it is used a handful of times a year.
-->
<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { COURSES } from './fixtures';

	let { open = $bindable(false) }: { open?: boolean } = $props();
	let courseId = $state(COURSES[0].id);

	const courseName = $derived(COURSES.find((c) => c.id === courseId)?.name);
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>New Class</Dialog.Title>
			<Dialog.Description>
				The Course is fixed at creation and cannot be changed later.
			</Dialog.Description>
		</Dialog.Header>

		<Field.Group>
			<Field.Field>
				<Field.Label for="label">Label</Field.Label>
				<Input id="label" placeholder="9B/Sc1" autocomplete="off" class="h-7" />
				<Field.Description>However it appears on your timetable.</Field.Description>
			</Field.Field>
			<Field.Field>
				<Field.Label for="course">Course</Field.Label>
				<Select.Root type="single" bind:value={courseId}>
					<Select.Trigger size="sm" id="course" class="w-full">{courseName}</Select.Trigger>
					<Select.Content>
						{#each COURSES as c (c.id)}
							<Select.Item value={c.id} label={c.name} />
						{/each}
					</Select.Content>
				</Select.Root>
				<Field.Description>
					A mis-pick means deleting the Class and starting again.
				</Field.Description>
			</Field.Field>
		</Field.Group>

		<Dialog.Footer>
			<Button variant="ghost" size="sm" onclick={() => (open = false)}>Cancel</Button>
			<Button size="sm" onclick={() => (open = false)}>Create Class</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
