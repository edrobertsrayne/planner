<script lang="ts">
	import { deserialize, enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import type { ActionResult, SubmitFunction } from '@sveltejs/kit';
	import { failureReason } from '$lib/client/enhance';
	import { createLessonSaver } from '$lib/client/lesson-save';
	import MarkdownEditor from '$lib/components/markdown-editor.svelte';
	import { toast } from '$lib/ui/toast';

	// The Class note, written the way a Lesson's notes are (ADR-0032): the same editor, saved on
	// blur, once typing pauses, and as the page unloads, all through the one `?/setClassNote`.
	let { classId, note }: { classId: string; note: string | null } = $props();

	let form: HTMLFormElement | null = $state(null);

	const saver = createLessonSaver({
		save: async (keepalive) => {
			if (!form) return;
			const response = await fetch(form.action, {
				method: 'POST',
				body: new FormData(form),
				keepalive,
				headers: { 'x-sveltekit-action': 'true' }
			});
			if (keepalive) return;
			const result: ActionResult = deserialize(await response.text());
			if (result.type !== 'success') throw new Error('The Class note did not save.');
		}
	});
	onMount(() => {
		const flush = () => saver.flush();
		window.addEventListener('pagehide', flush);
		return () => window.removeEventListener('pagehide', flush);
	});

	// The editor holds the note, so the form is never reset under it.
	const save: SubmitFunction =
		() =>
		async ({ result, update }) => {
			if (result.type === 'failure') toast.error(failureReason(result, 'Could not save the note.'));
			else await update({ reset: false });
		};
</script>

<form bind:this={form} method="POST" action="?/setClassNote" use:enhance={save} class="min-w-0">
	<input type="hidden" name="classId" value={classId} />
	<MarkdownEditor
		name="note"
		value={note ?? ''}
		label="Class note"
		placeholder="The room, routines, groupings, what is due this term…"
		bodyClass="min-h-[28rem]"
		onchange={() => saver.edited()}
		onblur={() => form?.requestSubmit()}
	/>
</form>
