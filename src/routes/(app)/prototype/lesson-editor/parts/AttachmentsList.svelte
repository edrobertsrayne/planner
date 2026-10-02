<script lang="ts">
	import FileIcon from '@lucide/svelte/icons/file';
	import UploadIcon from '@lucide/svelte/icons/upload';
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '$lib/components/ui/button/index.js';
	import { formatSize, type FakeLesson } from '../fake.svelte';

	// `dropzone` swaps the small "+ Add Attachment" button for a large drop target.
	let { lesson, dropzone = false }: { lesson: FakeLesson; dropzone?: boolean } = $props();

	let fileInput: HTMLInputElement | null = $state(null);
	let over = $state(false);

	function addFiles(files: FileList | null | undefined) {
		for (const f of files ?? []) {
			lesson.attachments.push({ id: crypto.randomUUID(), filename: f.name, size: f.size });
		}
	}
</script>

<ul class="space-y-1">
	{#each lesson.attachments as a (a.id)}
		<li class="group flex items-center gap-2 rounded-md bg-muted px-2 py-1.5 text-sm">
			<FileIcon class="size-3.5 shrink-0 text-muted-foreground" />
			<span class="min-w-0 flex-1 truncate">{a.filename}</span>
			<span class="shrink-0 text-xs text-muted-foreground">{formatSize(a.size)}</span>
			<Button
				variant="ghost"
				size="icon-xs"
				class="opacity-0 group-hover:opacity-100"
				aria-label="Delete {a.filename}"
				onclick={() => (lesson.attachments = lesson.attachments.filter((x) => x.id !== a.id))}
			>
				<XIcon />
			</Button>
		</li>
	{/each}
	{#if !lesson.attachments.length && !dropzone}
		<li class="px-1 py-1 text-xs text-muted-foreground">No Attachments yet.</li>
	{/if}
</ul>

<input
	bind:this={fileInput}
	type="file"
	multiple
	class="hidden"
	onchange={(e) => {
		addFiles(e.currentTarget.files);
		e.currentTarget.value = '';
	}}
/>

{#if dropzone}
	<button
		type="button"
		class="mt-2 flex w-full flex-col items-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-sm text-muted-foreground transition-colors {over
			? 'border-primary bg-primary/5'
			: 'border-border hover:bg-muted/50'}"
		onclick={() => fileInput?.click()}
		ondragover={(e) => {
			e.preventDefault();
			over = true;
		}}
		ondragleave={() => (over = false)}
		ondrop={(e) => {
			e.preventDefault();
			over = false;
			addFiles(e.dataTransfer?.files);
		}}
	>
		<UploadIcon class="size-5" />
		Drop files here, or click to choose
		<span class="text-xs">Up to 10 MB each</span>
	</button>
{:else}
	<Button
		variant="ghost"
		size="sm"
		class="mt-1 text-xs text-muted-foreground"
		onclick={() => fileInput?.click()}
	>
		+ Add Attachment
	</Button>
{/if}
