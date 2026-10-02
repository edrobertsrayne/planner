<script lang="ts">
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import UnlinkIcon from '@lucide/svelte/icons/unlink';
	import { Button } from '$lib/components/ui/button/index.js';
	import { fakeAction } from '../fake.svelte';

	// `explained` adds one line under each action saying what it does — for layouts with room.
	let { explained = false }: { explained?: boolean } = $props();
</script>

{#if explained}
	<div class="grid gap-3 sm:grid-cols-2">
		<div class="rounded-lg border p-3">
			<Button variant="outline" size="sm" onclick={() => fakeAction('Detach this Lesson')}>
				<UnlinkIcon data-icon="inline-start" />
				Detach from Topic
			</Button>
			<p class="mt-2 text-xs text-muted-foreground">
				Takes the Lesson out of the Topic. It keeps its plan, Links and Attachments, and every Class
				that taught it still shows it. One-way.
			</p>
		</div>
		<div class="rounded-lg border border-destructive/30 p-3">
			<Button variant="destructive" size="sm" onclick={() => fakeAction('delete this Lesson')}>
				<Trash2Icon data-icon="inline-start" />
				Delete Lesson
			</Button>
			<p class="mt-2 text-xs text-muted-foreground">
				Removes the Lesson and its Attachments. Refused once a Class has been taught it.
			</p>
		</div>
	</div>
{:else}
	<div class="flex flex-wrap gap-1">
		<Button variant="ghost" size="sm" onclick={() => fakeAction('Detach this Lesson')}>
			<UnlinkIcon data-icon="inline-start" />
			Detach
		</Button>
		<Button
			variant="ghost"
			size="sm"
			class="text-destructive hover:text-destructive"
			onclick={() => fakeAction('delete this Lesson')}
		>
			<Trash2Icon data-icon="inline-start" />
			Delete
		</Button>
	</div>
{/if}
