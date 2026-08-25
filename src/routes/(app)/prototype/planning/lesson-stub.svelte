<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import type { MockLesson, Status } from './data';

	// The Lesson editor, opened over the board by a title click (pinned on #102).
	// Its Draft/Planned control is #105's single-select chip group. It is here so the two
	// writing surfaces can be judged together: does the row need to match this, or not?

	let {
		lesson,
		setStatus,
		onclose
	}: {
		lesson: MockLesson | null;
		setStatus: (id: string, status: Status) => void;
		onclose: () => void;
	} = $props();
</script>

{#if lesson}
	<Dialog.Root open onOpenChange={(o) => !o && onclose()}>
		<Dialog.Content class="sm:max-w-md">
			<Dialog.Header>
				<Dialog.Title>{lesson.title}</Dialog.Title>
				<Dialog.Description>{lesson.topicName} · {lesson.courseName}</Dialog.Description>
			</Dialog.Header>

			<div class="flex flex-col gap-2">
				<Label>Planning status</Label>
				<ToggleGroup.Root
					type="single"
					variant="outline"
					size="sm"
					value={lesson.status}
					onValueChange={(v) => v && setStatus(lesson.id, v as Status)}
					class="justify-start"
				>
					<ToggleGroup.Item value="draft">Draft</ToggleGroup.Item>
					<ToggleGroup.Item value="planned">Planned</ToggleGroup.Item>
				</ToggleGroup.Root>
				<p class="text-xs text-muted-foreground">
					The chip group settled on #105 — one chip per status, exactly one always selected.
				</p>
			</div>

			<div class="flex flex-col gap-2">
				<Label for="proto-body">Body</Label>
				<Textarea
					id="proto-body"
					rows={4}
					placeholder="PROTOTYPE — markdown body, links, Planned Length live here."
				/>
			</div>

			<Dialog.Footer class="mt-2">
				<Button size="sm" onclick={onclose}>Back to Planning</Button>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>
{/if}
